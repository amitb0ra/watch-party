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
    });

    // Set an initial expiry, in case no one ever joins
    await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY_SECONDS);

    console.log(`[REST] Room created: ${roomId}`);
    res.status(201).json({ roomId });
  });

  app.post("/api/join-room", async (req, res) => {
    const { roomId } = req.body;

    // The new "guard": Check if the room's state HASH exists.
    const roomExists = await redisClient.exists(`room:${roomId}`);

    if (!roomId || !roomExists) {
      return res.status(404).json({ error: "Room not found" });
    }

    console.log(`[REST] User joining room: ${roomId}`);
    res.status(200).json({ success: true });
  });

  io.on("connection", (socket: SocketWithRoom) => {
    console.log(`[Socket.IO] User connected: ${socket.id}`);

    socket.on(
      "room:join",
      async (data: { roomId: string; userName: string }) => {
        const { roomId, userName } = data;

        // Re-check existence just in case
        const roomExists = await redisClient.exists(`room:${roomId}`);

        if (!roomExists) {
          console.warn(`[Socket.IO] Invalid room join attempt: ${roomId}`);

          // Tell the client this join failed
          socket.emit("room:join_failed", { error: "Room does not exist" });
          return;
        }

        // It saves your persistent userName (like "Sleepy Fox") and the roomId onto your temporary socket connection. This is so it knows who you are when you eventually disconnect.
        socket.data.roomId = roomId;
        socket.data.userName = userName;

        // adds your socket to the Socket.IO "room."
        socket.join(roomId);

        // dds your userName to a persistent "who is in this room" list in Redis. This is the real list of users, which solves your refresh problem.
        await redisClient.sAdd(`users:${roomId}`, userName);

        // Because you just joined, the server tells Redis to cancel any 5-minute self-destruct timers for the room's data. This ensures the room stays alive as long as people are in it.
        await redisClient.persist(`room:${roomId}`);
        await redisClient.persist(`chat:${roomId}`);
        await redisClient.persist(`users:${roomId}`);

        console.log(`[Socket.IO] User ${socket.id} joined room ${roomId}`);

        const userList = await redisClient.sMembers(`users:${roomId}`);
        io.to(roomId).emit("room:users_update", userList);

        const roomState = await redisClient.hGetAll(`room:${roomId}`);

        socket.emit("room:sync", {
          videoUrl: roomState.videoUrl || "",
          currentTime: parseFloat(roomState.currentTime || "0"),
          isPlaying: roomState.isPlaying === "true",
        });

        const chatHistory = await redisClient.lRange(`chat:${roomId}`, 0, -1);

        const messages = chatHistory.map((msg) => JSON.parse(msg));

        socket.emit("chat:history", messages);
      }
    );

    socket.on("video:change", async (data: { roomId: string; url: string }) => {
      await redisClient.hSet(`room:${data.roomId}`, {
        videoUrl: data.url,
        currentTime: 0,
        isPlaying: "false",
      });

      const roomState = await redisClient.hGetAll(`room:${data.roomId}`);
      const stateToEmit = {
        videoUrl: roomState.videoUrl || "",
        currentTime: parseFloat(roomState.currentTime || "0"),
        isPlaying: roomState.isPlaying === "true",
      };

      io.to(data.roomId).emit("video:changed", stateToEmit);
    });

    socket.on("video:play", async (data: { roomId: string; time: number }) => {
      await redisClient.hSet(`room:${data.roomId}`, {
        isPlaying: "true",
        currentTime: data.time.toString(),
      });
      socket.to(data.roomId).emit("video:played", { time: data.time });
    });

    socket.on("video:pause", async (data: { roomId: string; time: number }) => {
      await redisClient.hSet(`room:${data.roomId}`, {
        isPlaying: "false",
        currentTime: data.time.toString(),
      });
      socket.to(data.roomId).emit("video:paused", { time: data.time });
    });

    socket.on("video:seek", async (data: { roomId: string; time: number }) => {
      await redisClient.hSet(
        `room:${data.roomId}`,
        "currentTime",
        data.time.toString()
      );
      socket.to(data.roomId).emit("video:seeked", { time: data.time });
    });

    socket.on(
      "chat:send",
      async (data: { roomId: string; message: string; userName: string }) => {
        const message = {
          id: `${socket.id}-${Date.now()}`,
          text: data.message,
          user: data.userName,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          avatar: data.userName[0]?.toUpperCase() || "G",
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
      const { roomId, userName } = socket.data;

      if (roomId && userName) {
        await redisClient.sRem(`users:${roomId}`, userName);

        // const userCount = await redisClient.sCard(`users:${roomId}`);
        const userList = await redisClient.sMembers(`users:${roomId}`);
        io.to(roomId).emit("room:users_update", userList);

        const userCount = userList.length;

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

  httpServer.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
};
startServer();
