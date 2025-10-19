"use client";

import { use, useEffect, useState, FormEvent, useRef } from "react";
import { socket } from "@/lib/socket";
// import ReactPlayer from "react-player";

interface Message {
  id: string;
  text: string;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // Player state
  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=LXb3EKWsInQ"
  ); // A default video
  const [inputUrl, setInputUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  // const playerRef = useRef<ReactPlayer>(null);

  // --- Event Handlers ---

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      socket.emit("sendMessage", { roomId, message: input });
      setInput("");
    }
  };

  const handleUrlChange = (e: FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      socket.emit("changeVideo", { roomId, url: inputUrl });
    }
  };

  const handlePlay = () => {
    socket.emit("playerStateChange", { roomId, playing: true });
    setIsPlaying(true);
  };

  const handlePause = () => {
    socket.emit("playerStateChange", { roomId, playing: false });
    setIsPlaying(false);
  };

  const handleSeek = (seconds: number) => {
    socket.emit("seek", { roomId, time: seconds });
  };

  // --- Socket Listeners ---

  useEffect(() => {
    socket.connect();
    socket.emit("joinRoom", roomId);

    // Chat listeners
    socket.on("receiveMessage", (newMessage: Message) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    // Player listeners
    socket.on("videoChanged", (newUrl: string) => {
      setVideoUrl(newUrl);
      setInputUrl(newUrl);
    });

    socket.on("playerStateUpdated", (playing: boolean) => {
      setIsPlaying(playing);
    });

    socket.on("seekToTime", (time: number) => {
      // playerRef.current?.seekTo(time, "seconds");
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      <header className="flex items-center justify-between p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">
          Room ID: <span className="font-mono text-blue-400">{roomId}</span>
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content: Video player and URL input */}
        <main className="flex-1 flex flex-col p-4 gap-4">
          <div className="w-full aspect-video bg-black">
            {/* <ReactPlayer
              ref={playerRef}
              url={videoUrl}
              width="100%"
              height="100%"
              controls={true}
              playing={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
            /> */}
          </div>
          <form onSubmit={handleUrlChange} className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter YouTube URL..."
              className="flex-1 bg-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 rounded-md px-4 py-2 font-semibold"
            >
              Load Video
            </button>
          </form>
        </main>

        {/* Chat Sidebar */}
        <aside className="w-80 flex flex-col bg-gray-800 border-l border-gray-700">
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-gray-700 rounded-lg p-3">
                <p>{msg.text}</p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-gray-700 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 rounded-md px-4 py-2 font-semibold"
            >
              Send
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
