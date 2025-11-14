import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

interface RoomState {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
}

interface SocketWithRoom extends Socket {
  roomId?: string;
}

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

const activeRooms = new Set<string>();
const rooms = new Map<string, RoomState>();

function getRoomState(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      videoUrl: "",
      currentTime: 0,
      isPlaying: false,
    });
  }
  return rooms.get(roomId)!;
}

app.post("/api/create-room", (req, res) => {
  const roomId = uuidv4();
  activeRooms.add(roomId);
  console.log(`[REST] Room created: ${roomId}`);
  res.status(201).json({ roomId });
});

app.post("/api/join-room", (req, res) => {
  const { roomId } = req.body;

  if (!roomId || !activeRooms.has(roomId)) {
    return res.status(404).json({ error: "Room not found" });
  }

  console.log(`[REST] User joining room: ${roomId}`);
  res.status(200).json({ success: true });
});

io.on("connection", (socket: SocketWithRoom) => {
  console.log(`[Socket.IO] User connected: ${socket.id}`);

  socket.on("room:join", (roomId: string) => {
    // if (!activeRooms.has(roomId)) {
    //   console.warn(`[Socket.IO] Invalid room join attempt: ${roomId}`);
    //   return;
    // }

    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`[Socket.IO] User ${socket.id} joined room ${roomId}`);

    const state = getRoomState(roomId);
    socket.emit("room:sync", state);
  });

  socket.on("video:load", (data: { roomId: string; url: string }) => {
    const roomState = getRoomState(data.roomId);
    roomState.videoUrl = data.url;
    roomState.currentTime = 0;
    roomState.isPlaying = false;
    io.to(data.roomId).emit("video:loaded", roomState);
  });

  socket.on("video:play", (data: { roomId: string; time: number }) => {
    const roomState = getRoomState(data.roomId);
    roomState.isPlaying = true;
    roomState.currentTime = data.time;
    socket.to(data.roomId).emit("video:played", { time: data.time });
  });

  socket.on("video:pause", (data: { roomId: string; time: number }) => {
    const roomState = getRoomState(data.roomId);
    roomState.isPlaying = false;
    roomState.currentTime = data.time;
    socket.to(data.roomId).emit("video:paused", { time: data.time });
  });

  socket.on("video:seek", (data: { roomId: string; time: number }) => {
    const roomState = getRoomState(data.roomId);
    roomState.currentTime = data.time;
    socket.to(data.roomId).emit("video:seeked", { time: data.time });
  });

  socket.on(
    "chat:send",
    (data: { roomId: string; message: string; userName: string }) => {
      io.to(data.roomId).emit("chat:receive", {
        id: `${socket.id}-${Date.now()}`,
        text: data.message,
        user: data.userName,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        avatar: data.userName[0]?.toUpperCase() || "G",
        isSystem: false,
      });
    }
  );

  socket.on("disconnect", async () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    const { roomId } = socket;

    if (roomId) {
      const sockets = await io.in(roomId).allSockets();
      if (sockets.size === 0) {
        activeRooms.delete(roomId);
        rooms.delete(roomId);
        console.log(`[Socket.IO] Cleaned up empty room: ${roomId}`);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
