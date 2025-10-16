"use client";

import { useRouter } from "next/navigation";
import axios from "axios";

export default function HomePage() {
  const router = useRouter();

  const handleCreateRoom = async () => {
    try {
      const response = await axios.post(
        "http://localhost:8080/api/create-room"
      );
      const { roomId } = response.data;
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create a room. Please try again.");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-8">Watch Party 🎉</h1>
      <button
        onClick={handleCreateRoom}
        className="px-6 py-3 font-semibold text-lg bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        Create a New Room
      </button>
    </main>
  );
}
