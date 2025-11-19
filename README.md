# SideRow 🍿

**SideRow** is a real-time video synchronization platform that allows friends to watch videos together in perfect sync. Built with a modern tech stack, it features instant room creation, synchronized playback controls, and real-time chat.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Redis](https://img.shields.io/badge/Redis-Cache-red)

## ✨ Features

- **Synchronized Playback**: Play, pause, and seek videos in real-time across all connected clients.
- **Multi-Source Support**: Powered by `react-player`, supporting YouTube, SoundCloud, Vimeo, and more.
- **Real-time Chat**: Integrated chat system with emoji support to discuss the video as you watch.
- **Room System**: Create unique rooms instantly or join via Room ID/Link.
- **User Presence**: See who is currently in the room with visual avatars.
- **Drift Correction**: Automatic server-side clock synchronization to ensure no user falls behind.
- **Modern UI**: Built with Shadcn UI and Tailwind CSS v4 for a sleek, responsive experience.

## 🛠️ Tech Stack

### **Frontend**

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Shadcn UI, Lucide React
- **Real-time**: Socket.io Client
- **Media**: React Player

### **Backend**

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Real-time**: Socket.io
- **Database**: Redis (for room state and chat history persistence)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (v18 or newer)
- [pnpm](https://pnpm.io/) (v10.18.3 recommended)
- [Docker](https://www.docker.com/) (optional, for running Redis locally)

### 1. Clone the Repository

```bash
git clone [https://github.com/amitb0ra/siderow.git](https://github.com/amitb0ra/siderow.git)
cd siderow
```

### 2\. Install Dependencies

This project uses a monorepo structure. Install dependencies for both frontend and backend from the root:

```bash
pnpm install
```

### 3\. Infrastructure Setup (Redis)

The application requires a Redis instance to store room states and chat history.

**Option A: Run via Docker (Recommended)**

```bash
docker run -d -p 6379:6379 --name siderow-redis redis:latest
```

**Option B: Local Installation**
Ensure your local Redis server is running on port `6379`.

### 4\. Environment Configuration

Set up the environment variables for both the backend and frontend.

**Backend:**

```bash
cp backend/.env.example backend/.env
```

_Open `backend/.env` and update the `REDIS_URL` if your Redis setup differs from the default:_

```env
REDIS_URL="redis://default:your_redis_password@localhost:6379"
# If using the docker command above with no password:
# REDIS_URL="redis://localhost:6379"
```

**Frontend:**

```bash
cp frontend/.env.example frontend/.env
```

_Default content:_

```env
NEXT_PUBLIC_SERVER_URL="http://localhost:8080"
```

### 5\. Run the Application

You can start both the backend and frontend concurrently with a single command from the root directory:

```bash
pnpm start
```

- **Frontend** will be available at: `http://localhost:3000`
- **Backend** will run on: `http://localhost:8080`

---

## 📂 Project Structure

```
siderow/
├── backend/                # Express & Socket.io server
│   ├── src/
│   │   ├── index.ts        # Entry point & Socket logic
│   │   └── ...
│   └── ...
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # UI Components (Shadcn)
│   │   ├── lib/            # Utilities (Socket client, etc.)
│   │   └── ...
│   └── ...
└── package.json            # Root scripts
```

## 🤝 Development

To run services individually for debugging:

**Terminal 1 (Backend):**

```bash
pnpm --filter backend dev
```

**Terminal 2 (Frontend):**

```bash
pnpm --filter frontend dev
```

## 📜 License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).
