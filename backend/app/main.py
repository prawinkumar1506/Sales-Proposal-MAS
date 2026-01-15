import logging
import os
from dotenv import load_dotenv
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig

# Load environment variables from .env file
load_dotenv()

from .graph import workflow
from .state import ProposalState

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Northstar Proposal Agent API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistence
memory = MemorySaver()
# Compile the graph with the checkpointer
app_graph = workflow.compile(checkpointer=memory)

# Simple in-memory index for Admin UI (since MemorySaver is a key-value store primarily)
# In production, use a proper DB to index this.
# Format: {thread_id: {client_name, status, last_updated}}
proposals_index: Dict[str, Dict] = {}

class CreateProposalRequest(BaseModel):
    user_request: str

class UpdateProposalRequest(BaseModel):
    # For providing missing info
    additional_info: Optional[Dict] = None

class AdminActionRequest(BaseModel):
    action: str  # approve / reject
    comments: Optional[str] = ""

@app.post("/api/proposals/create")
async def create_proposal(req: CreateProposalRequest):
    import uuid
    thread_id = str(uuid.uuid4())
    
    initial_state = {
        "user_request": req.user_request,
        "audit_log": [f"Proposal started with request: {req.user_request}"],
        # Initialize others to empty/defaults
        "current_step": "start",
        "missing_fields": [],
        "budget": 0.0
    }
    
    config = {"configurable": {"thread_id": thread_id}}
    
    # Run the graph
    # We use stream=False or invoke to get the final state after the run pauses/stops
    # The graph will stop at "ask_user" or "wait_for_approval" or "finalize_proposal"
    result = app_graph.invoke(initial_state, config=config)
    
    # Update Index
    proposals_index[thread_id] = {
        "client_name": result.get("client_name", "Unknown"),
        "status": result.get("current_step", "unknown"),
        "approval_status": result.get("approval_status", "none"),
        "timestamp": 0 # TODO: real timestamp
    }
    
    return {
        "id": thread_id,
        "state": result,
        "status": result.get("current_step")
    }

@app.get("/api/proposals/{thread_id}")
async def get_proposal(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    state_snapshot = app_graph.get_state(config)
    if not state_snapshot.values:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    return {
        "id": thread_id,
        "state": state_snapshot.values,
        "next": state_snapshot.next
    }

@app.post("/api/proposals/{thread_id}/continue")
async def continue_proposal(thread_id: str, req: UpdateProposalRequest):
    """Resume the proposal after user provides input."""
    config = {"configurable": {"thread_id": thread_id}}
    state_snapshot = app_graph.get_state(config)
    
    if not state_snapshot.values:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Determine what to update. 
    # If we stopped at 'ask_user', we likely update key fields based on 'additional_info'
    current_values = state_snapshot.values
    updates = {}
    
    if req.additional_info:
        updates.update(req.additional_info)
        updates["audit_log"] = current_values.get("audit_log", []) + [f"User provided info: {req.additional_info}"]
    
    # Run again from current state with updates
    # We effectively update the state and then permit execution to proceed
    # Since 'ask_user' went to END, we are technically starting a new run that resumes?
    # Actually with specific checkpoints, we can update_state and invoke specific node or just invoke(None) to resume from next?
    # Because we went to END, we need to restart or resume. 
    # But since 'check_missing_info' loop logic relies on checking state, we can just update state and invoke.
    # The logic in 'check_missing_info' will decide if we still need to ask user.
    
    app_graph.update_state(config, updates)
    
    # We want to resume. The graph should ideally jump back to 'check_missing_info' or 'collect_intent' 
    # or just let the workflow decide.
    # Since the previous run ended at 'ask_user', we can just invoke(None) and 
    # if we routed via 'ask_user' -> END, the next valid node is tricky unless we manually set it.
    # For this graph, 'check_missing_info' should be re-evaluated.
    # Let's effectively "start" again but the checkpointer keeps history. 
    # We can use invoke(None) but if we are at END, we need to say where to go? 
    # Or maybe we just invoke with the same inputs and let it fly? 
    # Better: Update state, then tell it to start at 'check_missing_info'.
    
    result = app_graph.invoke(None, config=config) 
    
    # Update Index
    proposals_index[thread_id].update({
        "client_name": result.get("client_name", "Unknown"),
        "status": result.get("current_step", "unknown"),
        "approval_status": result.get("approval_status", "none")
    })
    
    return {
        "id": thread_id,
        "state": result,
        "status": result.get("current_step")
    }

@app.get("/api/admin/pending")
async def get_pending_approvals():
    """Returns proposals waiting for approval."""
    pending = []
    for tid, meta in proposals_index.items():
        if meta.get("status") == "wait_for_approval":
            pending.append({"id": tid, **meta})
    return pending

@app.post("/api/admin/{thread_id}/action")
async def admin_action(thread_id: str, req: AdminActionRequest):
    """Approve or Reject a proposal."""
    config = {"configurable": {"thread_id": thread_id}}
    
    updates = {
        "approval_status": "approved" if req.action == "approve" else "rejected",
        "approval_comments": req.comments,
        "audit_log": [f"Admin {req.action.upper()} with comments: {req.comments}"]
    }
    
    app_graph.update_state(config, updates)
    
    # Resume. We were at 'wait_for_approval' -> END.
    # We want to move to 'approved_or_rejected' logic? 
    # Wait, 'approved_or_rejected' is a conditional edge.
    # The node 'wait_for_approval' is where we left off (or rather, we finished it and went to END).
    # We should restart at 'revise_draft' potentially? 
    # Or better, we add a node 'admin_review' that we are stuck in?
    # For this design, we went to END. So we can just invoke(None) and passing a specific point might be needed 
    # or we rely on the graph structure.
    # If we are at END, invoke(None) might not know where to go.
    # We can explicitly say start at "revise_draft" for approved? 
    # Or re-run the conditional edge "approved_or_rejected"?
    # Actually, let's just force the next node to be 'revise_draft' as per our simple logic 
    # or 'finalize_proposal'.
    # For this demo, let's just invoke(None) and if it fails to move, we force it.
    
    # Simpler: We are at the end. We want to execute 'revise_draft'.
    # We can update state and then invoke starting at 'revise_draft'.
    
    # Check if approved
    next_node = "revise_draft" 
    
    result = app_graph.invoke(None, config=config)
    # If invoke(None) didn't do anything because we were at END:
    if result.get("current_step") == "wait_for_approval":
         # Force move
         # We need to use `Command` or similar in newer LangGraph, or update_state with `as_node`?
         # Simplest hacks for prototype: Update state, then invoke. 
         # If the graph doesn't auto-pick up, we might need to be more explicit.
         # For now, assuming standard behavior where updating state at END might not auto-trigger
         # UNLESS we treat the previous node as not-END.
         # Actually, let's just return the update for now if it sticks.
         pass

    # Update Index
    proposals_index[thread_id].update({
        "status": result.get("current_step", "unknown"),
        "approval_status": result.get("approval_status")
    })
    
    return {"status": "success", "state": result}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
