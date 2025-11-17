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
import { Share2, X, Video, Loader2, AlertTriangle } from "lucide-react";
import ReactPlayer from "react-player";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { generateRandomName } from "@/lib/random-name";
import axios from "axios";
import { toast } from "sonner";
import { debounce } from "lodash";

export interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  avatar?: string;
}

export interface RoomState {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  lastServerTimestamp: number; // Add this
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const router = useRouter();
  const { roomId } = use(params);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [serverClockOffset, setServerClockOffset] = useState(0);
  // video states
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  // room validation states
  const [isValidating, setIsValidating] = useState(true);
  const [isInvalid, setIsInvalid] = useState(false);
  const [roomStatus, setRoomStatus] = useState("playing"); // <-- ADD THIS
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  // chat states
  const [messages, setMessages] = useState<Message[]>([]);

  // people states
  const [users, setUsers] = useState<string[]>([]);
  const [username, setUserName] = useState<string | null>(null);

  const checkRoomExists = async () => {
    try {
      await axios.post("http://localhost:8080/api/check-room", {
        roomId: roomId,
      });
      setIsValidating(false);
    } catch (error) {
      console.error("Room validation failed:", error);
      toast.error("Room does not exist.");
      setIsValidating(false);
      setIsInvalid(true);
      setTimeout(() => {
        router.push("/");
      }, 2000);
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem("username");
    if (savedName) {
      setUserName(savedName);
    } else {
      const newName = generateRandomName();
      localStorage.setItem("username", newName);
      setUserName(newName);
    }
  }, []);

  const getCurrentTime = (): number => playerRef.current?.currentTime ?? 0;

  const setPlayerRef = useCallback((player: HTMLVideoElement | null) => {
    if (player) {
      playerRef.current = player;
    }
  }, []);

  const onLeave = () => {
    socket.disconnect();
    router.push("/");
  };

  const handleInvite = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setShowInviteModal(false);
  };

  const handleUrlChange = (e: FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      socket.emit("video:change", { roomId, url: inputUrl });
    }
  };

  const debouncedProposeState = useCallback(
    debounce((state: { isPlaying: boolean; time: number }) => {
      console.log("Debounced seek fired:", state);
      socket.emit("video:propose_state", {
        roomId,
        ...state,
      });
    }, 500), // 500ms debounce. Tune as needed.
    [roomId, socket] // Dependencies
  );

  const proposeStateChange = (state: { isPlaying: boolean; time: number }) => {
    socket.emit("video:propose_state", {
      roomId,
      ...state,
    });
  };

  const handlePlay = () => {
    setIsPlaying(true);
    proposeStateChange({ isPlaying: true, time: getCurrentTime() });
  };

  const handlePause = () => {
    setIsPlaying(false);
    proposeStateChange({ isPlaying: false, time: getCurrentTime() });
  };

  // The debounced seek handler:
  const debouncedSeek = useCallback(
    debounce((time: number) => {
      console.log("Proposing seek:", time);
      // Do NOT set local state.
      socket.emit("video:propose_seek", { roomId, time });
    }, 500),
    [roomId, socket]
  );

  const handleSeeked = () => {
    debouncedSeek(getCurrentTime());
    // --- NEW ---
    // Now that we have *finished* seeking, tell the server we are ready.
    console.log("Finished seeking, reporting ready.");
    socket.emit("client:seek_ready", { roomId });
  };

  // Create a new helper function to apply state to the player
  const setPlayerState = (state: RoomState) => {
    setIsPlaying(state.isPlaying); // This triggers the UI

    if (playerRef.current) {
      // Force player to match
      if (state.isPlaying) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }

      // And force-seek to the new time.
      const timeDifference = Math.abs(
        playerRef.current.currentTime - state.currentTime
      );

      // Use a larger tolerance here, as this is a hard command
      if (timeDifference > 0.2) {
        playerRef.current.currentTime = state.currentTime;
      }
    }
  };

  useEffect(() => {
    // --- NEW GUARD ---
    if (!username || !isPlayerReady) {
      return;
    }
    // --- END NEW GUARD ---

    checkRoomExists().then(() => {
      syncClock();
      socket.connect();
      socket.emit("room:join", { roomId, username });
    });

    checkRoomExists().then(() => {
      socket.connect();
      socket.emit("room:join", { roomId, username });
    });

    const syncClock = async () => {
      let totalOffset = 0;
      const pings = 3; // Ping 3 times for a rough average

      for (let i = 0; i < pings; i++) {
        const clientStartTime = Date.now();
        const { data } = await axios.get("http://localhost:8080/api/time");
        const clientEndTime = Date.now();

        const rtt = clientEndTime - clientStartTime;
        const latency = rtt / 2;
        const serverTime = data.serverTime;

        // This is the magic:
        // (Server time + one-way-latency) - local "now"
        const offset = serverTime + latency - clientEndTime;
        totalOffset += offset;
      }

      const avgOffset = totalOffset / pings;
      setServerClockOffset(avgOffset);
      console.log(`Server clock offset calculated: ${avgOffset.toFixed(2)}ms`);
    };

    const seekToTime = (time: number) => {
      if (playerRef.current) {
        const timeDifference = Math.abs(playerRef.current.currentTime - time);
        if (timeDifference > 1.5) {
          playerRef.current.currentTime = time;
        }
      }
    };

    const handleChatHistory = (history: Message[]) => {
      setMessages(history);
    };
    const handleReceiveMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };
    const handleUsersUpdate = (userList: string[]) => {
      setUsers(userList);
    };

    socket.on(
      "video:command_seek",
      (state: { currentTime: number; isPlaying: boolean; newUrl?: string }) => {
        console.log("Seek command received, seeking to:", state.currentTime);

        // --- NEW LOGIC ---
        if (state.newUrl) {
          console.log("...and loading new URL:", state.newUrl);
          setVideoUrl(state.newUrl);
          setInputUrl(state.newUrl); // Keep the input box in sync
        }
        // --- END NEW LOGIC ---

        // This will trigger the player's onPause and seek
        setIsPlaying(state.isPlaying);

        if (playerRef.current) {
          playerRef.current.currentTime = state.currentTime;
        }

        // We are now officially buffering/seeking
        setIsBuffering(true);
        setRoomStatus("seeking");
      }
    );

    socket.on("video:execute_state", (state: RoomState) => {
      console.log("Coordinated state command received:", state);

      // Store this new authoritative state
      setRoomState(state);

      // Calculate *when* to execute this command
      const calculatedServerNow = Date.now() + serverClockOffset;
      const delay = state.lastServerTimestamp - calculatedServerNow;

      if (delay <= 0) {
        // We're late. Execute immediately.
        console.log("Executing state command immediately (late).");
        setPlayerState(state);
      } else {
        // We're early. Schedule the state change.
        console.log(`Scheduling state command in ${delay}ms.`);
        setTimeout(() => {
          console.log("Executing scheduled state command.");
          setPlayerState(state);
        }, delay);
      }
      // If the command is to play, the room is no longer seeking
      if (state.isPlaying) {
        setRoomStatus("playing"); // <-- ADD THIS
      }
    });

    // Listen for the failure event from the backend
    socket.on("room:join_failed", (data) => {
      console.error("Socket join failed:", data.error);
      toast.error("Failed to connect to room. Please try again.");
      router.push("/");
    });

    socket.on("room:state_update", (state: RoomState) => {
      console.log("Authoritative state received:", state);
      setRoomState(state);
      // 1. Update Video URL if it's different
      if (state.videoUrl && videoUrl !== state.videoUrl) {
        setVideoUrl(state.videoUrl);
      }

      // 2. Always update local playing state
      setIsPlaying(state.isPlaying);

      if (playerRef.current) {
        // 3. Force player to match server's play/pause state.
        // This is non-negotiable.
        if (state.isPlaying) {
          playerRef.current.play();
        } else {
          playerRef.current.pause();
        }

        // 4. Correct for time drift.
        // This replaces your old 1.5s tolerance bug.
        const calculatedServerNow = Date.now() + serverClockOffset;
        const serverTimeElapsed =
          (calculatedServerNow - state.lastServerTimestamp) / 1000.0;

        const expectedVideoTime = state.isPlaying
          ? state.currentTime + serverTimeElapsed
          : state.currentTime;
        const timeDifference = Math.abs(
          playerRef.current.currentTime - state.currentTime
        );

        // If drift is > 0.5s, force a seek.
        // This prevents jitter but snaps back on major desync.
        if (timeDifference > 0.75) {
          // Increase tolerance slightly
          console.log(
            `Correcting drift. Server: ${state.currentTime}, Client: ${playerRef.current.currentTime}`
          );
          playerRef.current.currentTime = expectedVideoTime;
        }
      }
    });

    socket.on("client:force_disconnect", (data: { message: string }) => {
      console.error("Forced to disconnect:", data.message);
      toast.error(`Disconnected: ${data.message}`);
      socket.disconnect();
      router.push("/");
    });

    socket.on("chat:history", handleChatHistory);
    socket.on("chat:receive", handleReceiveMessage);
    socket.on("room:users_update", handleUsersUpdate);

    return () => {
      socket.off("room:join_failed");
      socket.off("room:state_update");
      socket.off("chat:history", handleChatHistory);
      socket.off("chat:receive", handleReceiveMessage);
      socket.off("room:users_update", handleUsersUpdate);
      socket.off("client:force_disconnect");
      socket.disconnect();
    };
  }, [
    roomId,
    username,
    router,
    videoUrl,
    setPlayerState,
    serverClockOffset,
    isPlayerReady,
  ]); // <-- ADD isPlayerReady

  // This NEW useEffect runs a PROACTIVE sync loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && roomState && roomState.isPlaying) {
        // Calculate what the time *should* be
        const serverTimeElapsed =
          (Date.now() - roomState.lastServerTimestamp) / 1000.0;
        const expectedVideoTime = roomState.currentTime + serverTimeElapsed;

        const currentVideoTime = playerRef.current.currentTime;
        const drift = currentVideoTime - expectedVideoTime;

        // Correct if drift is significant (e.g., > 0.5s)
        if (Math.abs(drift) > 0.5) {
          console.warn(`Proactive sync. Drift: ${drift}s. Correcting.`);
          playerRef.current.currentTime = expectedVideoTime;
        }
      }
    }, 500); // Check for drift every 500ms
    return () => clearInterval(interval);
  }, [roomState]); // This loop re-evaluates whenever server state changes

  // validation loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground"> Wait a moment...</p>
      </div>
    );
  }

  // invalid room state
  if (isInvalid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-lg shadow-lg p-8 flex flex-col items-center text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-destructive-foreground mb-2">
            Invalid Room
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            The room you are trying to join does not exist.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Redirecting to the home page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
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
              {`${window.location.origin}/room/${roomId}`}
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

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-border">
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

          <div className="flex-1 overflow-auto bg-black relative">
            {/* --- ADD THIS OVERLAY --- */}
            {roomStatus === "seeking" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
                <p className="text-white text-lg font-semibold">
                  Syncing room...
                </p>
              </div>
            )}
            {videoUrl ? (
              <ReactPlayer
                ref={setPlayerRef}
                width="100%"
                height="100%"
                src={videoUrl}
                controls={true}
                playing={isPlaying && !isBuffering}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
                onWaiting={() => {
                  console.warn("Client is buffering...");
                  setIsBuffering(true);
                }}
                onPlaying={() => {
                  console.log("Client finished buffering.");
                  setIsBuffering(false);
                  // If we finished buffering, we are de-facto ready
                  console.log("Finished buffering, reporting ready.");
                  socket.emit("client:seek_ready", { roomId });
                }}
                onReady={() => {
                  console.log("ReactPlayer is ready.");
                  setIsPlayerReady(true);
                }}
                onError={(err) => {
                  console.error("Player error:", err);
                  // Tell the server we are broken
                  socket.emit("client:player_error", {
                    roomId,
                    message: err.toString(),
                  });
                  toast.error("A video player error occurred.");
                }}
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

        <div className="w-80 flex flex-col border-l border-border bg-card">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col">
              <ChatPanel
                username={username ?? ""}
                roomId={roomId}
                messages={messages}
              />
            </TabsContent>

            <TabsContent value="people" className="flex-1 flex flex-col">
              <UserPanel username={username ?? ""} users={users} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
