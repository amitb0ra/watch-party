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
const ROOM_EXPIRY_SECONDS = 300;

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
      lastServerTimestamp: 0,
    });

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
        user: "System",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: "⚙️",
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

        socket.emit("client:force_disconnect", { message: "Player error" });

        const { roomId, username } = socket.data;

        if (roomId && username) {
          await redisClient.sRem(`users:${roomId}`, username);
          const userList = await redisClient.sMembers(`users:${roomId}`);
          io.to(roomId).emit("room:users_update", userList);
          const userCount = userList.length;

          await redisClient.sRem(`ready:${roomId}`, username);

          const roomStatus = await redisClient.hGet(`room:${roomId}`, "status");

          if (roomStatus === "seeking") {
            const readyCount = await redisClient.sCard(`ready:${roomId}`);

            if (readyCount === userCount && userCount > 0) {
              console.log(
                `[Socket.IO] Erroring user was the last one. Resuming room.`
              );

              await redisClient.del(`ready:${roomId}`);
              await redisClient.hSet(`room:${roomId}`, "status", "playing");

              const roomState = await redisClient.hGetAll(`room:${roomId}`);
              const executionTimestamp = Date.now() + 300;

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

          if (userCount === 0) {
            console.log(
              `[Socket.IO] Room ${roomId} is empty after error/disconnect. Setting 5-min expiry.`
            );
            await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY_SECONDS);
            await redisClient.expire(`chat:${roomId}`, ROOM_EXPIRY_SECONDS);
            await redisClient.expire(`users:${roomId}`, ROOM_EXPIRY_SECONDS);
          }
        }
      }
    );

    socket.on(
      "room:join",
      async (data: { roomId: string; username: string }) => {
        const { roomId, username } = data;

        const roomExists = await redisClient.exists(`room:${roomId}`);

        if (!roomExists) {
          console.warn(`[Socket.IO] Invalid room join attempt: ${roomId}`);

          socket.emit("room:join_failed", { error: "Room does not exist" });
          return;
        }

        socket.data.roomId = roomId;
        socket.data.username = username;

        socket.join(roomId);

        await redisClient.sAdd(`users:${roomId}`, username);

        await redisClient.persist(`room:${roomId}`);
        await redisClient.persist(`chat:${roomId}`);
        await redisClient.persist(`users:${roomId}`);

        console.log(`[Socket.IO] User ${socket.id} joined room ${roomId}`);

        const userList = await redisClient.sMembers(`users:${roomId}`);
        io.to(roomId).emit("room:users_update", userList);

        const roomState = await redisClient.hGetAll(`room:${roomId}`);
        const roomStatus = roomState.status || "playing";

        if (roomStatus === "seeking") {
          console.log(
            `[Socket.IO] User ${username} joining a seeking room. Issuing seek command.`
          );
          socket.emit("video:command_seek", {
            currentTime: parseFloat(roomState.currentTime || "0"),
            isPlaying: false,
            newUrl: roomState.videoUrl || undefined,
          });

          const chatHistory = await redisClient.lRange(`chat:${roomId}`, 0, -1);
          const messages = chatHistory.map((msg) => JSON.parse(msg));
          socket.emit("chat:history", messages);
        } else {
          console.log(
            `[Socket.IO] User ${username} joining stable room. Sending state.`
          );

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
      }
    );

    socket.on("video:change", async (data: { roomId: string; url: string }) => {
      console.log(`[Socket.IO] New video proposed for ${data.roomId}`);
      await sendSystemMessage(
        data.roomId,
        `${socket.data.username} changed the video.`
      );

      await redisClient.hSet(`room:${data.roomId}`, {
        videoUrl: data.url,
        isPlaying: "false",
        currentTime: "0",
        lastServerTimestamp: Date.now().toString(),
        status: "seeking",
      });

      await redisClient.del(`ready:${data.roomId}`);

      io.to(data.roomId).emit("video:command_seek", {
        currentTime: 0,
        isPlaying: false,
        newUrl: data.url,
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

        await redisClient.hSet(`room:${data.roomId}`, {
          isPlaying: "false",
          currentTime: data.time.toString(),
          lastServerTimestamp: Date.now().toString(),
        });

        await redisClient.hSet(`room:${data.roomId}`, "status", "seeking");

        await redisClient.del(`ready:${data.roomId}`);

        const roomState = await redisClient.hGetAll(`room:${data.roomId}`);
        io.to(data.roomId).emit("video:command_seek", {
          currentTime: parseFloat(roomState.currentTime || "0"),
          isPlaying: false,
        });
      }
    );

    socket.on("client:seek_ready", async (data: { roomId: string }) => {
      const { roomId } = data;
      const username = socket.data.username;

      if (!username) return;

      await redisClient.sAdd(`ready:${roomId}`, username);

      const userCount = await redisClient.sCard(`users:${roomId}`);
      const readyCount = await redisClient.sCard(`ready:${roomId}`);

      console.log(`[Socket.IO] Ready check: ${readyCount} / ${userCount}`);

      if (readyCount === userCount) {
        console.log(
          `[Socket.IO] All users in ${roomId} are ready. Resuming play.`
        );

        await redisClient.del(`ready:${roomId}`);

        await redisClient.hSet(`room:${roomId}`, "status", "playing");

        const roomState = await redisClient.hGetAll(`room:${roomId}`);
        const executionTimestamp = Date.now() + 300;

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
          isPlaying: true,
          lastServerTimestamp: executionTimestamp,
        });
      }
    });

    socket.on(
      "video:propose_state",
      async (data: { roomId: string; isPlaying: boolean; time: number }) => {
        const lockKey = `lock:room:${data.roomId}`;
        const isLocked = await redisClient.exists(lockKey);

        if (isLocked) {
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

        await redisClient.set(lockKey, "1", { EX: 1 });

        const serverNow = Date.now();
        const executionTimestamp = serverNow + 300;

        await redisClient.hSet(`room:${data.roomId}`, {
          isPlaying: data.isPlaying ? "true" : "false",
          currentTime: data.time.toString(),
          lastServerTimestamp: executionTimestamp.toString(),
        });

        const videoUrl =
          (await redisClient.hGet(`room:${data.roomId}`, "videoUrl")) || "";

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

        const userList = await redisClient.sMembers(`users:${roomId}`);
        io.to(roomId).emit("room:users_update", userList);

        const userCount = userList.length;

        await redisClient.sRem(`ready:${roomId}`, username);

        const roomStatus = await redisClient.hGet(`room:${roomId}`, "status");

        if (roomStatus === "seeking") {
          console.log(
            `[Socket.IO] Disconnect during seek. Re-evaluating ready count.`
          );

          const readyCount = await redisClient.sCard(`ready:${roomId}`);

          if (readyCount === userCount && userCount > 0) {
            console.log(
              `[Socket.IO] All remaining users are ready. Resuming play.`
            );

            await redisClient.del(`ready:${roomId}`);
            await redisClient.hSet(`room:${roomId}`, "status", "playing");

            const roomState = await redisClient.hGetAll(`room:${roomId}`);
            const executionTimestamp = Date.now() + 300;

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
