"use client";

import {
  useEffect,
  useState,
  FormEvent,
  useRef,
  useCallback,
  use,
} from "react";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/components/chat-panel";
import { UserPanel } from "@/components/user-panel";
import { Share2, X, Video } from "lucide-react";
import ReactPlayer from "react-player";
import { Input } from "@/components/ui/input";

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const [userName, setUserName] = useState<string>("Guest");
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Player state
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [inputUrl, setInputUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  // Callback to set the ref
  const setPlayerRef = useCallback((player: HTMLVideoElement | null) => {
    if (player) {
      playerRef.current = player;
    }
  }, []);

  const onLeave = () => {
    if (typeof window !== "undefined") window.history.back();
  };

  const onUserNameChange = (name?: string) => {
    if (name) setUserName(name);
  };

  const handleInvite = () => {
    const inviteLink = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setShowInviteModal(false);
  };

  // --- Event Handlers ---
  const handleUrlChange = (e: FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      socket.emit("change-video", { roomId, url: inputUrl });
    }
  };

  const sendStateUpdate = (playing: boolean) => {
    const currentTime = playerRef.current?.currentTime ?? 0;
    socket.emit("update-state", {
      roomId,
      videoUrl,
      currentTime,
      isPlaying: playing,
    });
  };

  const handlePlay = () => {
    setIsPlaying(true);
    sendStateUpdate(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
    sendStateUpdate(false);
  };

  const handleSeeked = () => {
    sendStateUpdate(isPlaying);
  };

  // --- Socket Listeners ---
  useEffect(() => {
    socket.connect();
    socket.emit("join-room", roomId);

    const seekToTime = (time: number) => {
      if (playerRef.current) {
        if (Math.abs(playerRef.current.currentTime - time) > 1.5) {
          playerRef.current.currentTime = time;
        }
      }
    };

    socket.on("sync-state", (state) => {
      console.log("🔄 Syncing with room:", state);
      setVideoUrl(state.videoUrl || undefined);
      setIsPlaying(state.isPlaying);
      seekToTime(state.currentTime);
    });

    socket.on("state-updated", (state) => {
      console.log("🛰 Updated room state:", state);
      setVideoUrl(state.videoUrl || undefined);
      setIsPlaying(state.isPlaying);
      seekToTime(state.currentTime);
    });

    socket.on("video-changed", (newUrl: string) => {
      setVideoUrl(newUrl || undefined);
      setInputUrl(newUrl || "");
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">WatchParty</h1>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              Room: {roomId}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="gap-2"
            >
              <Share2 className="w-4 h-4" />
              Invite Friends
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onLeave}
              className="gap-2 text-destructive hover:text-destructive bg-transparent"
            >
              <X className="w-4 h-4" />
              Leave
            </Button>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Invite Friends
            </h2>
            <p className="text-sm text-muted-foreground">
              Share this link with your friends to invite them to the room
            </p>
            <div className="bg-muted p-3 rounded border border-border text-sm text-foreground break-all">
              {`${window.location.origin}?room=${roomId}`}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInvite} className="flex-1">
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowInviteModal(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Player */}
        <div className="flex-1 flex flex-col border-r border-border">
          {/* Player Controls */}
          <div className="bg-card border-b border-border p-4 space-y-3">
            <form onSubmit={handleUrlChange} className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter video URL..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Load Video</Button>
            </form>
          </div>

          {/* Video Player */}
          <div className="flex-1 overflow-auto bg-black">
            {videoUrl ? (
              <ReactPlayer
                ref={setPlayerRef as any}
                width="100%"
                height="100%"
                src={videoUrl}
                controls={true}
                playing={isPlaying}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Video className="w-16 h-16 mb-4" />
                <p>No video loaded</p>
                <p className="text-sm">
                  Paste a video URL above to start watching.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Chat & Users */}
        <div className="w-80 flex flex-col border-l border-border bg-card">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col">
              <ChatPanel userName={userName} roomId={roomId} />
            </TabsContent>

            <TabsContent value="people" className="flex-1 flex flex-col">
              <UserPanel
                userName={userName}
                onUserNameChange={onUserNameChange}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
