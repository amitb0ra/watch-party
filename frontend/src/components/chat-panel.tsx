"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile } from "lucide-react";
import { socket } from "@/lib/socket";

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  avatar?: string;
}

interface ChatPanelProps {
  userName: string;
  roomId: string;
}

const EMOJI_LIST = [
  "😀",
  "😂",
  "😍",
  "🤔",
  "😎",
  "🔥",
  "👍",
  "❤️",
  "😢",
  "🎉",
  "🎬",
  "📺",
  "🍿",
  "🎭",
  "⭐",
];

export function ChatPanel({ userName, roomId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleReceiveMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, []);

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
      socket.emit("send-message", {
        roomId,
        message: newMessage,
        userName,
      });
      setNewMessage("");
      setShowEmojiPicker(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(newMessage + emoji);
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

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
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

      <div className="border-t border-border p-3">
        <div className="relative">
          <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2">
            <Input
              placeholder="Enter a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-sm border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
            />

            {/* Emoji Picker Button */}
            <div className="relative" ref={emojiPickerRef}>
              <Button
                size="sm"
                variant="ghost"
                className="px-2 h-auto"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </Button>

              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-background border border-border rounded-md p-2 shadow-lg z-50 w-48">
                  <div className="grid grid-cols-5 gap-1">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => addEmoji(emoji)}
                        className="p-2 hover:bg-muted rounded text-lg transition-colors"
                        title={emoji}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Send Button */}
            <Button
              onClick={sendMessage}
              size="sm"
              variant="ghost"
              className="px-2 h-auto"
              title="Send message"
              type="button"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
