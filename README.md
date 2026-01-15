# Northstar Proposal Agent

A full-stack AI agent system simulating an enterprise workflow for proposal generation.

## Architecture

- **Backend**: Python FastAPI + CrewAI (Orchestration)
- **Frontend**: React + Vite + TailwindCSS
- **Agent**: CrewAI + Groq (Llama 3)

## Features

- **Agent Orchestration**: CrewAI-based workflow (Intent -> Draft -> Pricing -> Compliance -> Approval).
- **Mock Enterprise Systems**: Simulates CRM, Pricing Engine, and Compliance checks.
- **Human-in-the-Loop**: Admin approval workflow for high-risk proposals.
- **Real-time UI**: Copilot chat, live proposal viewer, and context-aware side panel.

## Setup

1. **Prerequisites**: Docker and Docker Compose (or Python+Node locally).
2. **Environment**:
   - Add your Groq API Key to `backend/.env` (Create the file if it doesn't exist):
     ```
     GROQ_API_KEY=your_api_key_here
     ```

### Running with Docker (Recommended)

To run the entire system (starting with Backend):

```bash
docker-compose up --build
```

Access the app at:
- Frontend (if running separately or via proxy): `http://localhost:5173`
- Backend API Docs: `http://localhost:8000/docs`

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

## Deployment

### Backend Only (Docker)
Build and run the backend container:

```bash
cd backend
docker build -t proposal-backend .
docker run -p 8000:8000 --env-file .env proposal-backend
```
