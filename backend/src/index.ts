// backend/src/index.ts
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = 8080;

app.use(cors());
app.use(express.json());

app.post("/api/create-room", (req, res) => {
  const roomId = uuidv4();
  console.log(`[REST] Room created: ${roomId}`);
  res.status(201).json({ roomId });
});

io.on("connection", (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.id}`);

  // --- Chat and Room Logic (Existing) ---
  socket.on("joinRoom", (roomId: string) => {
    socket.join(roomId);
    console.log(`[Socket.IO] User ${socket.id} joined room ${roomId}`);
  });

  socket.on("sendMessage", (data: { roomId: string; message: string }) => {
    io.to(data.roomId).emit("receiveMessage", {
      text: data.message,
      id: `${socket.id}-${Date.now()}`,
    });
  });

  // When a user changes the video URL
  socket.on("changeVideo", (data: { roomId: string; url: string }) => {
    // Broadcast to everyone in the room, including the sender
    io.to(data.roomId).emit("videoChanged", data.url);
  });

  // When a user plays or pauses the video
  socket.on(
    "playerStateChange",
    (data: { roomId: string; playing: boolean }) => {
      // Broadcast to others in the room
      socket.broadcast.to(data.roomId).emit("playerStateUpdated", data.playing);
    }
  );

  // When a user seeks to a new time
  socket.on("seek", (data: { roomId: string; time: number }) => {
    // Broadcast to others in the room
    socket.broadcast.to(data.roomId).emit("seekToTime", data.time);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
