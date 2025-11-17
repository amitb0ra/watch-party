"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Smile } from "lucide-react";
import { socket } from "@/lib/socket";
import EmojiPicker, {
  type EmojiClickData,
  type EmojiStyle,
  Theme,
} from "emoji-picker-react";
import { useTheme } from "next-themes";
import { type Message } from "@/app/room/[roomId]/page";

interface ChatPanelProps {
  username: string;
  roomId: string;
  messages: Message[];
}

export function ChatPanel({ username, roomId, messages }: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sendMessage = () => {
    if (newMessage.trim()) {
      socket.emit("chat:send", {
        roomId,
        message: newMessage,
        username,
      });
      setNewMessage("");
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addEmoji = (emojiData: EmojiClickData) => {
    setNewMessage(newMessage + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-green-500",
      "bg-orange-500",
    ];
    if (!name) return colors[0];
    const hash = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
    return colors[hash % colors.length];
  };

  const pickerTheme = theme === "dark" ? Theme.DARK : Theme.LIGHT;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 border-red-500 border min-h-0">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              {msg.isSystem ? (
                <div className="text-xs text-muted-foreground italic text-center py-2">
                  {msg.text}
                </div>
              ) : (
                <div className="flex gap-2">
                  <div
                    className={`w-8 h-8 rounded-full ${getAvatarColor(
                      msg.user
                    )} text-white flex items-center justify-center text-xs font-semibold flex-shrink-0`}
                  >
                    {msg.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-primary">
                        {msg.user}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="text-foreground mt-1 break-words">
                      {msg.text}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="py-2 px-1">
        <div className="flex w-full items-center gap-2">
          <div className="relative flex-1" ref={emojiPickerRef}>
            <Input
              placeholder="Enter a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pr-10"
            />

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:text-primary"
            >
              <Smile className="size-5" />
            </Button>

            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 w-[300px] mb-2 z-50">
                <EmojiPicker
                  onEmojiClick={addEmoji}
                  height={400}
                  width="100%"
                  emojiStyle={"facebook" as EmojiStyle}
                  previewConfig={{ showPreview: false }}
                  theme={pickerTheme}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
