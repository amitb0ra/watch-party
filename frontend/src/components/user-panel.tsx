"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";

interface User {
  id: string;
  name: string;
  joinedAt: string;
  status: "active" | "idle" | "watching";
  isMuted?: boolean;
  isAudioMuted?: boolean;
}

interface UserPanelProps {
  userName: string;
  onUserNameChange?: (name: string) => void;
}

// Mock Data
const mockUsers: User[] = [
  {
    id: "1",
    name: "Sezal",
    joinedAt: "17:15:00",
    status: "active",
    isMuted: false,
    isAudioMuted: false,
  },
  {
    id: "2",
    name: "Alex",
    joinedAt: "17:16:30",
    status: "watching",
    isMuted: false,
    isAudioMuted: false,
  },
  {
    id: "3",
    name: "Jordan",
    joinedAt: "17:17:45",
    status: "active",
    isMuted: true,
    isAudioMuted: false,
  },
];

const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-green-500",
  "bg-orange-500",
];

export function UserPanel({ userName, onUserNameChange }: UserPanelProps) {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [editableName, setEditableName] = useState(userName);
  const [isSavingName, setIsSavingName] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "idle":
        return "bg-yellow-500";
      case "watching":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "idle":
        return "Idle";
      case "watching":
        return "Watching";
      default:
        return "Offline";
    }
  };

  const toggleUserMute = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId ? { ...user, isMuted: !user.isMuted } : user
      )
    );
  };

  const toggleUserAudio = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? { ...user, isAudioMuted: !user.isAudioMuted }
          : user
      )
    );
  };

  const removeUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId));
  };

  const handleSaveName = () => {
    const newName = editableName.trim();
    if (newName) {
      localStorage.setItem("watchparty_userName", newName);
      onUserNameChange?.(newName);
      setIsSavingName(false);
    }
  };

  const getAvatarColor = (name: string) => {
    if (!name) return avatarColors[0];
    const hash = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
    return avatarColors[hash % avatarColors.length];
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div>
        <label className="text-sm font-semibold text-foreground block mb-2">
          My name is:
        </label>
        <div className="flex gap-2">
          <Input
            value={editableName}
            onChange={(e) => {
              setEditableName(e.target.value);
              setIsSavingName(true);
            }}
            className="text-sm flex-1"
            placeholder="Enter your name"
          />
          <Button
            onClick={handleSaveName}
            disabled={!editableName.trim() || editableName === userName}
            className="px-4"
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            People{" "}
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs">
              {users.length}
            </span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {users.map((user) => (
            <Card
              key={user.id}
              className="p-3 bg-background border-border hover:border-primary transition-colors"
            >
              <div className="space-y-2">
                {/* User Header */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full ${getAvatarColor(
                      user.name
                    )} text-white flex items-center justify-center text-sm font-semibold relative`}
                  >
                    {user.name[0]}
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                        user.status
                      )}`}
                      title={getStatusLabel(user.status)}
                    ></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getStatusLabel(user.status)} • Joined {user.joinedAt}
                    </p>
                  </div>
                  <button
                    onClick={() => removeUser(user.id)}
                    className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove user"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* User Controls */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={user.isMuted ? "destructive" : "outline"}
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => toggleUserMute(user.id)}
                    title={user.isMuted ? "Unmute chat" : "Mute chat"}
                  >
                    {user.isMuted ? (
                      <>
                        <MicOff className="w-3 h-3" />
                        Muted
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        Unmuted
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={user.isAudioMuted ? "destructive" : "outline"}
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => toggleUserAudio(user.id)}
                    title={user.isAudioMuted ? "Unmute audio" : "Mute audio"}
                  >
                    {user.isAudioMuted ? (
                      <>
                        <VolumeX className="w-3 h-3" />
                        Audio
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" />
                        Audio
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
