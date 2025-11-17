"use client";

import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";

interface UserPanelProps {
  username: string;
  users: string[];
}

const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-green-500",
  "bg-orange-500",
];

export function UserPanel({ username, users }: UserPanelProps) {
  const getAvatarColor = (name: string) => {
    if (!name) return avatarColors[0];
    const hash =
      name.charCodeAt(0) +
      (name.length > 0 ? name.charCodeAt(name.length - 1) : 0);
    return avatarColors[hash % avatarColors.length];
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
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
