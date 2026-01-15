from langgraph.graph import StateGraph, END
from .state import ProposalState
from .nodes import (
    collect_intent, fetch_crm, check_missing_info, ask_user,
    generate_draft, pricing_agent, compliance_agent,
    wait_for_approval, revise_draft, finalize_proposal
)

def should_ask_user(state: ProposalState):
    """Conditional edge: If fields are missing, go to ask_user, else generate_draft."""
    if state.get("missing_fields"):
        return "ask_user"
    return "generate_draft"

def check_approval_needed(state: ProposalState):
    """Conditional edge: If compliance issues or high discount, need approval."""
    compliance = state.get("compliance_status", {})
    pricing = state.get("pricing", {})
    
    # If compliance failed, or margin is low (example rule)
    if not compliance.get("passed", True) or pricing.get("margin", 1.0) < 0.2:
        return "wait_for_approval"
    
    return "finalize_proposal"

def approved_or_rejected(state: ProposalState):
    """Conditional edge after approval step."""
    status = state.get("approval_status")
    if status == "approved":
        return "revise_draft"
    elif status == "rejected":
        # In a real app, this might go back to ask_user or a dead end.
        # For this flow, we'll go to revise to fix issues.
        return "revise_draft" 
    else:
        # If still pending (shouldn't happen if we wait), stay or error.
        # We assume the external trigger moves it, so this might be reached 
        # when we resume.
        return "wait_for_approval"

workflow = StateGraph(ProposalState)

# Add Nodes
workflow.add_node("collect_intent", collect_intent)
workflow.add_node("fetch_crm", fetch_crm)
workflow.add_node("check_missing_info", check_missing_info)
workflow.add_node("ask_user", ask_user)
workflow.add_node("generate_draft", generate_draft)
workflow.add_node("pricing_agent", pricing_agent)
workflow.add_node("compliance_agent", compliance_agent)
workflow.add_node("wait_for_approval", wait_for_approval)
workflow.add_node("revise_draft", revise_draft)
workflow.add_node("finalize_proposal", finalize_proposal)

# Add Edges
workflow.set_entry_point("collect_intent")
workflow.add_edge("collect_intent", "fetch_crm")
workflow.add_edge("fetch_crm", "check_missing_info")

# Conditional: Missing Info?
workflow.add_conditional_edges(
    "check_missing_info",
    should_ask_user,
    {
        "ask_user": "ask_user",
        "generate_draft": "generate_draft"
    }
)

# If we ask user, we basically stop effectively (in a real server we'd return a suspend state or loop back after input)
# Ideally, we want the graph to stop at "ask_user" so the API can return to the frontend.
# We'll make "ask_user" an END point for this run, so the user can reply and we restart/resume.
workflow.add_edge("ask_user", END)

workflow.add_edge("generate_draft", "pricing_agent")
workflow.add_edge("pricing_agent", "compliance_agent")

# Conditional: Approval Needed?
workflow.add_conditional_edges(
    "compliance_agent",
    check_approval_needed,
    {
        "wait_for_approval": "wait_for_approval",
        "finalize_proposal": "finalize_proposal"
    }
)

# If waiting for approval, we stop.
workflow.add_edge("wait_for_approval", END)

# If we resume after approval (we'll likely trigger revise_draft directly or have a specialized awake step)
# For simplicity in graph definition:
workflow.add_edge("revise_draft", "finalize_proposal")
workflow.add_edge("finalize_proposal", END)

app_graph = workflow.compile()
