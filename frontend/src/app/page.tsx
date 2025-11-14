"use client";

import { SetStateAction, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, LogIn, Zap, Users, Clock, LinkIcon, Play } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // todo: Fetch recently joined rooms from local storage
  const recentlyJoinedRooms = [
    { id: "xyz-123", name: "Family Movie Night" },
    { id: "abc-456", name: "Friends Watch Party" },
    { id: "def-789", name: "Gaming Stream" },
  ];

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const response = await axios.post(
        "http://localhost:8080/api/create-room"
      );
      const { roomId } = response.data;
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create a room. Please try again.");
    }
    setIsCreating(false);
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      toast.error("Please enter a valid room code");
      return;
    }

    try {
      setIsJoining(true);
      await new Promise((r) => setTimeout(r, 300));
      const response = await axios.post("http://localhost:8080/api/join-room", {
        roomId: joinCode.trim(),
      });

      if (response.status === 200) {
        router.push(`/room/${joinCode.trim()}`);
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
        setJoinCode(roomIdMatch[1]);
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      toast.error("Failed to read from clipboard.");
    }
  };

  const handleRecentRoomClick = (roomId: SetStateAction<string>) => {
    setJoinCode(roomId);
    handleJoinRoom();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
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
          {/* Create Room Card */}
          <Card className="p-8 bg-gradient-to-br from-card to-card/80 border-border hover:border-primary/50 transition-all hover:shadow-lg flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
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

              {/* Features List */}
              <div className="bg-muted/50 p-4 rounded-lg my-4 border border-border/50">
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

              {/* Create Room Button */}
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

          {/* Join Room Card */}
          <Card className="p-8 bg-gradient-to-br from-card to-card/80 border-border hover:border-primary/50 transition-all hover:shadow-lg flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
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

              {/* Recently Joined Rooms List */}
              {recentlyJoinedRooms.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    Recently Joined
                  </h3>
                  {recentlyJoinedRooms.map((room) => (
                    <Button
                      key={room.id}
                      variant="ghost"
                      onClick={() => handleRecentRoomClick(room.id)}
                      className="w-full justify-start gap-2 text-base text-muted-foreground hover:text-primary hover:bg-primary/5 px-4 py-3 h-auto"
                    >
                      <Play className="h-4 w-4 text-primary" />
                      <span>{room.name}</span>
                    </Button>
                  ))}
                </div>
              )}

              {/* Join Room Input */}
              <div className="relative">
                <Input
                  placeholder="Enter room ID..."
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
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

              {/* Join Room Button*/}
              <Button
                onClick={handleJoinRoom}
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
