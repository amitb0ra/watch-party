import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
interface SocketWithRoom extends Socket {}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = 8080;
const ROOM_EXPIRY_SECONDS = 300; // 5 minutes

app.use(cors());
app.use(express.json());

const startServer = async () => {
  console.log(process.env.REDIS_URL);
  const redisClient = createClient({
    url: process.env.REDIS_URL,
  });
  redisClient.on("error", (err) => console.log("Redis Client Error", err));

  await redisClient.connect();
  console.log("Connected to Redis");

  app.post("/api/create-room", async (req, res) => {
    const roomId = uuidv4();

    await redisClient.sAdd("activeRooms", roomId);

    await redisClient.hSet(`room:${roomId}`, {
      videoUrl: "",
      currentTime: 0,
      isPlaying: "false",
      lastServerTimestamp: 0, // Add this
    });

    // Set an initial expiry, in case no one ever joins
    await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY_SECONDS);

    console.log(`[REST] Room created: ${roomId}`);
    res.status(201).json({ roomId });
  });

  app.post("/api/check-room", async (req, res) => {
    const { roomId } = req.body;
    const roomExists = await redisClient.exists(`room:${roomId}`);

    if (!roomId || !roomExists) {
      return res.status(404).json({ error: "Room not found" });
    }

    console.log(`[REST] Room exists check: ${roomId}`);
    res.status(200).json({ success: true });
  });

  io.on("connection", (socket: SocketWithRoom) => {
    console.log(`[Socket.IO] User connected: ${socket.id}`);

    const sendSystemMessage = async (roomId: string, text: string) => {
      const message = {
        id: `system-${Date.now()}`,
        text: text,
        user: "System", // Or whatever you prefer
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: "⚙️", // Or any emoji
        isSystem: true,
      };

      const chatKey = `chat:${roomId}`;
      await redisClient.rPush(chatKey, JSON.stringify(message));
      await redisClient.lTrim(chatKey, -500, -1);

      io.to(roomId).emit("chat:receive", message);
    };

    socket.on(
      "client:player_error",
      async (data: { roomId: string; message: string }) => {
        console.error(
          `[Socket.IO] Player error from ${socket.data.username}: ${data.message}`
        );

        // Tell this specific client to disconnect
        socket.emit("client:force_disconnect", { message: "Player error" });

        // Now, treat them as a normal disconnect to fix any "seeking" freezes
        const { roomId, username } = socket.data;

        if (roomId && username) {
          // 1. Remove user from the primary user list
          await redisClient.sRem(`users:${roomId}`, username);
          const userList = await redisClient.sMembers(`users:${roomId}`);
          io.to(roomId).emit("room:users_update", userList);
          const userCount = userList.length;

          // 2. Remove user from the "ready" list
          await redisClient.sRem(`ready:${roomId}`, username);

          // 3. Check if the room was stuck seeking
          const roomStatus = await redisClient.hGet(`room:${roomId}`, "status");

          if (roomStatus === "seeking") {
            const readyCount = await redisClient.sCard(`ready:${roomId}`);

            // 4. Check if all *remaining* users are now ready
            if (readyCount === userCount && userCount > 0) {
              console.log(
                `[Socket.IO] Erroring user was the last one. Resuming room.`
              );

              // --- This is the "resume" logic ---
              await redisClient.del(`ready:${roomId}`);
              await redisClient.hSet(`room:${roomId}`, "status", "playing");

              const roomState = await redisClient.hGetAll(`room:${roomId}`);
              const executionTimestamp = Date.now() + 300; // 300ms buffer

              await redisClient.hSet(`room:${roomId}`, "isPlaying", "true");
              await redisClient.hSet(
                `room:${roomId}`,
                "lastServerTimestamp",
                executionTimestamp.toString()
              );

              io.to(roomId).emit("video:execute_state", {
                videoUrl: roomState.videoUrl || "",
                currentTime: parseFloat(roomState.currentTime || "0"),
                isPlaying: true,
                lastServerTimestamp: executionTimestamp,
              });
              // --- End of "resume" logic ---
            }
          }

          // 5. Check if the room is now empty
          if (userCount === 0) {
            // --- This is the "expire room" logic ---
            console.log(
              `[Socket.IO] Room ${roomId} is empty after error/disconnect. Setting 5-min expiry.`
            );
            await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY_SECONDS);
            await redisClient.expire(`chat:${roomId}`, ROOM_EXPIRY_SECONDS);
            await redisClient.expire(`users:${roomId}`, ROOM_EXPIRY_SECONDS);
            // --- End of "expire room" logic ---
          }
        }
      }
    );

    socket.on(
      "room:join",
      async (data: { roomId: string; username: string }) => {
        const { roomId, username } = data;

        // Re-check existence just in case
        const roomExists = await redisClient.exists(`room:${roomId}`);

        if (!roomExists) {
          console.warn(`[Socket.IO] Invalid room join attempt: ${roomId}`);

          // Tell the client this join failed
          socket.emit("room:join_failed", { error: "Room does not exist" });
          return;
        }

        // It saves your persistent username (like "Sleepy Fox") and the roomId onto your temporary socket connection. This is so it knows who you are when you eventually disconnect.
        socket.data.roomId = roomId;
        socket.data.username = username;

        // adds your socket to the Socket.IO "room."
        socket.join(roomId);

        // dds your username to a persistent "who is in this room" list in Redis. This is the real list of users, which solves your refresh problem.
        await redisClient.sAdd(`users:${roomId}`, username);

        // Because you just joined, the server tells Redis to cancel any 5-minute self-destruct timers for the room's data. This ensures the room stays alive as long as people are in it.
        await redisClient.persist(`room:${roomId}`);
        await redisClient.persist(`chat:${roomId}`);
        await redisClient.persist(`users:${roomId}`);

        console.log(`[Socket.IO] User ${socket.id} joined room ${roomId}`);

        const userList = await redisClient.sMembers(`users:${roomId}`);
        io.to(roomId).emit("room:users_update", userList);

        const roomState = await redisClient.hGetAll(`room:${roomId}`);
        const roomStatus = roomState.status || "playing";
        // --- NEW JOIN LOGIC ---
        if (roomStatus === "seeking") {
          // The room is busy. Enroll the new user in the current seek.
          console.log(
            `[Socket.IO] User ${username} joining a seeking room. Issuing seek command.`
          );
          socket.emit("video:command_seek", {
            currentTime: parseFloat(roomState.currentTime || "0"),
            isPlaying: false,
            newUrl: roomState.videoUrl || undefined,
          });

          // Also send them chat history
          const chatHistory = await redisClient.lRange(`chat:${roomId}`, 0, -1);
          const messages = chatHistory.map((msg) => JSON.parse(msg));
          socket.emit("chat:history", messages);
        } else {
          // Room is stable. Send them the current state.
          console.log(
            `[Socket.IO] User ${username} joining stable room. Sending state.`
          );

          // Emit the authoritative state directly to the new user
          socket.emit("room:state_update", {
            videoUrl: roomState.videoUrl || "",
            currentTime: parseFloat(roomState.currentTime || "0"),
            isPlaying: roomState.isPlaying === "true",
            lastServerTimestamp: parseInt(
              roomState.lastServerTimestamp || "0",
              10
            ),
          });

          const chatHistory = await redisClient.lRange(`chat:${roomId}`, 0, -1);
          const messages = chatHistory.map((msg) => JSON.parse(msg));
          socket.emit("chat:history", messages);
        }
        // --- END NEW LOGIC ---
      }
    );

    socket.on("video:change", async (data: { roomId: string; url: string }) => {
      console.log(`[Socket.IO] New video proposed for ${data.roomId}`);
      await sendSystemMessage(
        data.roomId,
        `${socket.data.username} changed the video.`
      );
      // 1. Update Redis with all new state
      await redisClient.hSet(`room:${data.roomId}`, {
        videoUrl: data.url, // Set the new URL
        isPlaying: "false", // Force pause
        currentTime: "0", // Reset time
        lastServerTimestamp: Date.now().toString(),
        status: "seeking", // Set status to seeking
      });

      // 2. Clear the 'ready' list (CRITICAL)
      await redisClient.del(`ready:${data.roomId}`);

      // 3. Tell everyone to pause, seek to 0, and load the new URL
      io.to(data.roomId).emit("video:command_seek", {
        currentTime: 0,
        isPlaying: false,
        newUrl: data.url, // <-- Pass the new URL in the command
      });
    });

    socket.on(
      "video:propose_seek",
      async (data: { roomId: string; time: number }) => {
        console.log(
          `[Socket.IO] Seek proposed for ${data.roomId} to ${data.time}`
        );
        await sendSystemMessage(
          data.roomId,
          `${socket.data.username} is seeking...`
        );
        // ... (rest of the function)

        // 1. Update Redis state to "paused at new time"
        await redisClient.hSet(`room:${data.roomId}`, {
          isPlaying: "false", // Force pause
          currentTime: data.time.toString(),
          lastServerTimestamp: Date.now().toString(),
        });

        // 2. Add a "room status" flag
        await redisClient.hSet(`room:${data.roomId}`, "status", "seeking");

        // 3. Clear the 'ready' list from any previous seek event
        await redisClient.del(`ready:${data.roomId}`);

        // 3. Tell everyone to pause and seek
        const roomState = await redisClient.hGetAll(`room:${data.roomId}`);
        io.to(data.roomId).emit("video:command_seek", {
          currentTime: parseFloat(roomState.currentTime || "0"),
          isPlaying: false, // Explicitly tell them to pause
        });
      }
    );

    // Now, handle the ready signal
    socket.on("client:seek_ready", async (data: { roomId: string }) => {
      const { roomId } = data;
      const username = socket.data.username; // We stored this on join

      if (!username) return;

      // Add user to the "ready" set
      await redisClient.sAdd(`ready:${roomId}`, username);

      const userCount = await redisClient.sCard(`users:${roomId}`);
      const readyCount = await redisClient.sCard(`ready:${roomId}`);

      console.log(`[Socket.IO] Ready check: ${readyCount} / ${userCount}`);

      // If all users are ready
      if (readyCount === userCount) {
        console.log(
          `[Socket.IO] All users in ${roomId} are ready. Resuming play.`
        );

        // 1. Clear the "ready" list for the next seek
        await redisClient.del(`ready:${roomId}`);

        // 2. Set room status back to "playing"
        await redisClient.hSet(`room:${roomId}`, "status", "playing");

        // 3. Use the *exact same* "Coordinated Start" logic from Section 1
        const roomState = await redisClient.hGetAll(`room:${roomId}`);
        const executionTimestamp = Date.now() + 300; // 300ms buffer

        await redisClient.hSet(`room:${roomId}`, "isPlaying", "true");
        await redisClient.hSet(
          `room:${roomId}`,
          "lastServerTimestamp",
          executionTimestamp.toString()
        );

        await sendSystemMessage(
          roomId,
          "All users are synced. Resuming playback."
        );

        io.to(roomId).emit("video:execute_state", {
          videoUrl: roomState.videoUrl || "",
          currentTime: parseFloat(roomState.currentTime || "0"),
          isPlaying: true, // Resume play
          lastServerTimestamp: executionTimestamp,
        });
      }
    });

    socket.on(
      "video:propose_state",
      async (data: { roomId: string; isPlaying: boolean; time: number }) => {
        // 1. CHECK FOR A LOCK
        const lockKey = `lock:room:${data.roomId}`;
        const isLocked = await redisClient.exists(lockKey);

        if (isLocked) {
          // Room is thrashing. Ignore this event.
          console.log(
            `[Socket.IO] Room ${data.roomId} is locked. Ignoring state proposal.`
          );
          return;
        }
        const action = data.isPlaying ? "resumed" : "paused";
        await sendSystemMessage(
          data.roomId,
          `${socket.data.username} ${action} the video.`
        );

        // 2. SET THE LOCK
        // Set a 1-second lock. Tune as needed.
        await redisClient.set(lockKey, "1", { EX: 1 });

        const serverNow = Date.now();
        const executionTimestamp = serverNow + 300;
        // 3. Update the authoritative state in Redis (as before)
        await redisClient.hSet(`room:${data.roomId}`, {
          isPlaying: data.isPlaying ? "true" : "false",
          currentTime: data.time.toString(),
          lastServerTimestamp: executionTimestamp.toString(), // The time the state *will be* valid
        });

        // 6. BROADCAST THE NEW *COORDINATED* EVENT (New logic)
        const videoUrl =
          (await redisClient.hGet(`room:${data.roomId}`, "videoUrl")) || "";

        // We use io.to() (not socket.broadcast.to())
        // The sender *must* also wait for the coordinated command.
        io.to(data.roomId).emit("video:execute_state", {
          videoUrl: videoUrl,
          currentTime: data.time,
          isPlaying: data.isPlaying,
          lastServerTimestamp: executionTimestamp,
        });
      }
    );

    socket.on(
      "chat:send",
      async (data: { roomId: string; message: string; username: string }) => {
        const message = {
          id: `${socket.id}-${Date.now()}`,
          text: data.message,
          user: data.username,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          avatar: data.username[0]?.toUpperCase() || "G",
          isSystem: false,
        };

        const chatKey = `chat:${data.roomId}`;
        await redisClient.rPush(chatKey, JSON.stringify(message));
        await redisClient.lTrim(chatKey, -500, -1);

        io.to(data.roomId).emit("chat:receive", message);
      }
    );

    socket.on("disconnect", async () => {
      console.log(`[Socket.IO] User disconnected: ${socket.id}`);
      const { roomId, username } = socket.data;

      if (roomId && username) {
        await redisClient.sRem(`users:${roomId}`, username);

        // const userCount = await redisClient.sCard(`users:${roomId}`);
        const userList = await redisClient.sMembers(`users:${roomId}`);
        io.to(roomId).emit("room:users_update", userList);

        const userCount = userList.length;

        // --- NEW FAULT-TOLERANCE LOGIC ---

        // 1. Also remove the user from the "ready" list, just in case they disconnected
        //    *after* clicking ready but *before* the room resumed.
        await redisClient.sRem(`ready:${roomId}`, username);

        // 2. Check if the room was stuck in a "seeking" state
        const roomStatus = await redisClient.hGet(`room:${roomId}`, "status");

        if (roomStatus === "seeking") {
          console.log(
            `[Socket.IO] Disconnect during seek. Re-evaluating ready count.`
          );
          // 3. Re-check the counts.
          const readyCount = await redisClient.sCard(`ready:${roomId}`);

          if (readyCount === userCount && userCount > 0) {
            // If the disconnected user was the only one not ready, resume for everyone else.
            console.log(
              `[Socket.IO] All remaining users are ready. Resuming play.`
            );

            // This is the SAME logic from your 'client:seek_ready' handler
            await redisClient.del(`ready:${roomId}`);
            await redisClient.hSet(`room:${roomId}`, "status", "playing");

            const roomState = await redisClient.hGetAll(`room:${roomId}`);
            const executionTimestamp = Date.now() + 300; // 300ms buffer

            await redisClient.hSet(`room:${roomId}`, "isPlaying", "true");
            await redisClient.hSet(
              `room:${roomId}`,
              "lastServerTimestamp",
              executionTimestamp.toString()
            );

            io.to(roomId).emit("video:execute_state", {
              videoUrl: roomState.videoUrl || "",
              currentTime: parseFloat(roomState.currentTime || "0"),
              isPlaying: true,
              lastServerTimestamp: executionTimestamp,
            });
          }
        }
        // --- END NEW LOGIC ---

        console.log(`[Socket.IO] Users left in ${roomId}: ${userCount}`);

        if (userCount === 0) {
          console.log(
            `[Socket.IO] Room ${roomId} is empty. Setting 5-min expiry.`
          );
          await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY_SECONDS);
          await redisClient.expire(`chat:${roomId}`, ROOM_EXPIRY_SECONDS);
          await redisClient.expire(`users:${roomId}`, ROOM_EXPIRY_SECONDS);
        }
      }
    });
  });

  app.get("/api/time", (req, res) => {
    res.json({ serverTime: Date.now() });
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
};
startServer();
