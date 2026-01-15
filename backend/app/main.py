import logging
import os
from dotenv import load_dotenv
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid

# Load environment variables from .env file
load_dotenv()

from .crew_system import process_proposal, finalize_proposal, proposals_store

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Northstar Proposal Agent API")

@app.get("/health")
async def health_check():
    """Simple health check endpoint to keep the server awake."""
    return {"status": "active", "service": "northstar-backend"}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory index for Admin UI
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
    """Create a new proposal."""
    thread_id = str(uuid.uuid4())
    
    # Process the initial request
    state = process_proposal(thread_id, req.user_request)
    
    # Update Index
    proposals_index[thread_id] = {
        "client_name": state.get("client_name", "Unknown"),
        "status": state.get("current_step", "unknown"),
        "approval_status": state.get("approval_status", "none"),
        "timestamp": 0  # TODO: real timestamp
    }
    
    return {
        "id": thread_id,
        "state": state,
        "status": state.get("current_step"),
        "question": state.get("current_question")  # If asking user
    }


@app.get("/api/proposals/{thread_id}")
async def get_proposal(thread_id: str):
    """Get proposal state."""
    if thread_id not in proposals_store:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    state = proposals_store[thread_id]
    
    return {
        "id": thread_id,
        "state": state,
        "next": []  # Simple function-based workflow doesn't have next steps
    }


@app.post("/api/proposals/{thread_id}/continue")
async def continue_proposal(thread_id: str, req: UpdateProposalRequest):
    """Resume the proposal after user provides input."""
    if thread_id not in proposals_store:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    if not req.additional_info:
        raise HTTPException(status_code=400, detail="additional_info is required")
    
    # Get the user's response
    user_response = req.additional_info.get("response", "")
    
    if not user_response or not user_response.strip():
        raise HTTPException(status_code=400, detail="User response cannot be empty")
    
    # Handle image uploads
    state = proposals_store[thread_id]
    if "image_base64" in req.additional_info and "image_note" in req.additional_info:
        image_data = {
            "base64": req.additional_info["image_base64"],
            "description": req.additional_info["image_note"],
            "section": "general"
        }
        state["uploaded_images"] = state.get("uploaded_images", []) + [image_data]
    
    # Process the user's response
    state = process_proposal(thread_id, user_response)
    
    # Update Index
    if thread_id in proposals_index:
        proposals_index[thread_id].update({
            "client_name": state.get("client_name", "Unknown"),
            "status": state.get("current_step", "unknown"),
            "approval_status": state.get("approval_status", "none")
        })
    
    return {
        "id": thread_id,
        "state": state,
        "status": state.get("current_step"),
        "question": state.get("current_question")  # Next question if still asking
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
    """Approve or Reject a proposal after pricing/compliance review."""
    if thread_id not in proposals_store:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    state = proposals_store[thread_id]
    
    if req.action == "approve":
        # Finalize the proposal
        state = finalize_proposal(thread_id, req.comments)
    else:
        # Reject - update status
        state["approval_status"] = "rejected"
        state["approval_comments"] = req.comments
        state["audit_log"].append(f"Admin REJECTED: {req.comments}")
    
    # Update Index
    proposals_index[thread_id].update({
        "status": state.get("current_step", "unknown"),
        "approval_status": state.get("approval_status")
    })
    
    return {
        "status": "success",
        "state": state,
        "approval_status": state.get("approval_status")
    }


@app.get("/api/proposals/{thread_id}/finalized")
async def get_finalized_proposal(thread_id: str):
    """Returns the finalized sales proposal for display."""
    if thread_id not in proposals_store:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    state = proposals_store[thread_id]
    
    # Check if proposal is finalized
    if state.get("approval_status") != "finalized":
        raise HTTPException(status_code=400, detail="Proposal not finalized yet")
    
    # Validate that we have the required data
    final_draft = state.get("final_draft") or state.get("draft_v2") or state.get("draft_v1")
    if not final_draft:
        raise HTTPException(status_code=500, detail="Finalized proposal content not found")
    
    # Return the finalized proposal data
    return {
        "id": thread_id,
        "status": "finalized",
        "proposal": final_draft,
        "client_name": state.get("client_name", "Unknown"),
        "deal_type": state.get("deal_type", "Unknown"),
        "budget": state.get("budget", 0),
        "timeline": state.get("timeline", "Unknown"),
        "pricing": state.get("pricing", {}),
        "compliance_status": state.get("compliance_status", "approved"),
        "audit_log": state.get("audit_log", []),
        "finalized_timestamp": state.get("audit_log", [])[-1] if state.get("audit_log") else None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
