"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { socket } from "@/lib/socket";

interface UserPanelProps {
  username: string;
  onUserNameChange?: (name: string) => void;
  users: string[];
}

const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-green-500",
  "bg-orange-500",
];

export function UserPanel({
  username,
  onUserNameChange,
  users,
}: UserPanelProps) {
  const [editableName, setEditableName] = useState(username);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    setEditableName(username);
  }, [username]);

  const getAvatarColor = (name: string) => {
    if (!name) return avatarColors[0];
    const hash =
      name.charCodeAt(0) +
      (name.length > 0 ? name.charCodeAt(name.length - 1) : 0);
    return avatarColors[hash % avatarColors.length];
  };

  const handleSaveName = () => {
    const newName = editableName.trim();
    // Use the `username` prop as the "oldName"
    const oldName = username;

    if (newName && newName !== oldName) {
      // 1. Tell the backend about the name change *first*.
      socket.emit("user:name_change", { oldName, newName });

      // 2. Then, update local state
      localStorage.setItem("username", newName);
      onUserNameChange?.(newName);
      setIsSavingName(false);
    }
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
              setIsSavingName(editableName.trim() !== username.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveName();
            }}
            className="text-sm flex-1"
            placeholder="Enter your name"
          />
          <Button
            onClick={handleSaveName}
            disabled={!editableName.trim() || editableName === username}
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
          {users.map((name) => (
            <Card key={name} className="p-3 bg-background border-border">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full ${getAvatarColor(
                    name
                  )} text-white flex items-center justify-center text-sm font-semibold relative`}
                >
                  {name[0]?.toUpperCase() || "•"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {name}
                    {/* Show a " (You)" badge if this is the current user */}
                    {name === username && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        (You)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
