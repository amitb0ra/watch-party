## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- `pnpm` (v10.18.3 or compatible)
- Redis server (local or remote)

### 1\. Clone & Install

Clone the repository and install all dependencies using `pnpm`.

```bash
git clone https://github.com/amitb0ra/watch-party.git
cd watch-party
pnpm install
```

### 2\. Set Up Environment Variables

- **Backend**:

```bash
  cp backend/.env.example backend/.env
```

- **Frontend**:

```bash
  cp frontend/.env.example frontend/.env
```

### 3\. Run Redis (if not already running)

If you have Docker, run the following command in your terminal:

```bash
docker run -d -p 6379:6379 redis:latest
```

### 4\. Run the Application

You can run both apps concurrently with a single command from the root directory:

```bash
pnpm start
```

Alternatively, you can run them in separate terminals for more detailed logs:

**Terminal 1 (Backend):**

```bash
pnpm --filter backend dev
```

**Terminal 2 (Frontend):**

```bash
pnpm --filter frontend dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to use the app.
