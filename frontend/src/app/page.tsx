"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  LogIn,
  Zap,
  Users,
  Clock,
  LinkIcon,
  History,
} from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function HomePage() {
  const router = useRouter();

  const [inputCode, setInputCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [lastJoinedRoom, setLastJoinedRoom] = useState("");

  useEffect(() => {
    const savedRoom = localStorage.getItem("lastJoinedRoom");
    if (savedRoom) {
      setLastJoinedRoom(savedRoom);
    }
  }, []);

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/create-room` ||
          "http://localhost:8080/api/create-room"
      );
      const { roomId } = response.data;
      localStorage.setItem("lastJoinedRoom", roomId);
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create a room. Please try again.");
    }
    setIsCreating(false);
  };

  const handleJoinRoom = async (roomIdToJoin?: string) => {
    const roomId = (roomIdToJoin || inputCode).trim();

    if (!roomId) {
      toast.error("Please enter a valid room code");
      return;
    }

    try {
      setIsJoining(true);
      await new Promise((r) => setTimeout(r, 300));
      const response = await axios.post(
        "http://localhost:8080/api/check-room",
        {
          roomId: roomId,
        }
      );

      if (response.status === 200) {
        localStorage.setItem("lastJoinedRoom", roomId);
        router.push(`/room/${roomId}`);
      }
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Room not found or unavailable.");
    } finally {
      setIsJoining(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const roomIdMatch =
        text.match(
          /\/room\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/
        ) ||
        text.match(
          /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/
        );

      if (roomIdMatch && roomIdMatch[1]) {
        setInputCode(roomIdMatch[1]);
        toast.success("Room code pasted!");
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      toast.error("Failed to read from clipboard.");
    }
  };

  const handleRecentRoomClick = (roomId: string) => {
    setInputCode(roomId);
    handleJoinRoom(roomId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              WatchParty
            </h1>
          </div>
          <p className="text-muted-foreground">
            Ready to watch something amazing together?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="p-8 bg-gradient-to-br from-card to-card/80 border-border hover:border-primary/50 transition-all hover:shadow-lg flex flex-col">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Create Room
                  </h2>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Start a new watch party and share the room ID with your friends.
                They can join instantly!
              </p>
            </div>

            <div className="flex-1 py-6">
              <div className="bg-muted/50 p-4 rounded-lg border border-border/50 h-full flex flex-col justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-4 h-4" />
                  <span>Synchronized playback</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Invite friends easily via link or code</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Zap className="w-4 h-4" />
                  <span>Real-time chat during playback</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleCreateRoom}
                disabled={isCreating}
                variant="outline"
                className="w-full gap-3 h-14 font-semibold text-lg rounded-lg border-primary text-primary hover:bg-primary/5"
              >
                {isCreating && (
                  <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                {isCreating ? "Creating..." : "Create Room"}
              </Button>
            </div>
          </Card>
          <Card className="p-8 bg-gradient-to-br from-card to-card/80 border-border hover:border-primary/50 transition-all hover:shadow-lg flex flex-col">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <LogIn className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Join Room
                  </h2>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Have a room ID? Paste it here to join your friends' watch party
                and start watching together!
              </p>
            </div>

            <div className="flex-1 py-6">
              {lastJoinedRoom && (
                <div className="h-full">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Recent Room
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => handleRecentRoomClick(lastJoinedRoom)}
                    className="w-full justify-start gap-3 text-sm h-12 bg-muted/50 hover:bg-muted"
                  >
                    <History className="h-4 w-4 text-primary" />
                    <span className="font-mono text-foreground/80 truncate flex-1 text-left">
                      {lastJoinedRoom}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Click to join
                    </span>
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="Enter room ID..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !isJoining && handleJoinRoom()
                  }
                  disabled={isJoining}
                  className="text-xl font-mono h-14 px-4 pr-12 rounded-lg"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground hover:text-primary"
                  title="Paste from clipboard"
                >
                  <LinkIcon className="h-5 w-5" />
                </Button>
              </div>
              <Button
                onClick={() => handleJoinRoom(inputCode)}
                disabled={isJoining}
                variant="outline"
                className="w-full gap-3 h-14 font-semibold text-lg rounded-lg border-primary text-primary hover:bg-primary/5"
              >
                {isJoining && (
                  <div className="w-5 h-5 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                {isJoining ? "Joining..." : "Join Room"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
