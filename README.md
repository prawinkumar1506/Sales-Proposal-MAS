# Northstar Proposal Agent

A full-stack AI agent system simulating an enterprise workflow for proposal generation.

## Architecture

- **Backend**: Python FastAPI + LangGraph
- **Frontend**: React + Vite + TailwindCSS
- **Agent**: LangChain + Groq (Llama 3)

## Features

- **Agent Orchestration**: State-based workflow (Intent -> Draft -> Pricing -> Compliance -> Approval).
- **Mock Enterprise Systems**: Simulates CRM, Pricing Engine, and Compliance checks.
- **Human-in-the-Loop**: Admin approval workflow for high-risk proposals.
- **Real-time UI**: Copilot chat, live proposal viewer, and context-aware side panel.

## Setup

1. **Prerequisites**: Docker and Docker Compose (or Python+Node locally).
2. **Environment**:
   - Add your Groq API Key to `backend/.env`.

### Running Locally (Manual)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Running with Docker

```bash
docker-compose up --build
```

Access the app at `http://localhost:5173`.
Admin dashboard at `http://localhost:5173/admin`.
