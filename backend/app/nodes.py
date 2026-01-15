import os
from typing import Dict, Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .state import ProposalState
from .mocks import MockCRM, MockPricingEngine, MockComplianceEngine

# Initialize LLM
# Note: Ensure GROQ_API_KEY is in os.environment or .env
llm = ChatGroq(model_name="llama3-70b-8192", temperature=0.7)

def collect_intent(state: ProposalState) -> Dict:
    """Analyzes the user request to extract intent and basic info."""
    print(f"--- Node: collect_intent ---")
    user_request = state["user_request"]
    
    # Simple extraction via LLM (or regex for this demo if LLM fails)
    # We'll use LLM for robust extraction
    system = "You are a sales assistant. Extract the client_name, deal_type, budget, and timeline from the user request. Return JSON only."
    human = f"Request: {user_request}"
    
    # In a real app, we'd use function calling or JSON mode. 
    # For now, we'll simulate extraction if the LLM isn't fully wired or just do basic string search for the scaffold
    
    # SCENARIO: Let's assume the LLM works or we parse simple keywords for the demo scaffold if keys are missing
    # But let's try to use the LLM if we can, wrapped in try/except for safety in this scaffold
    
    extracted = {}
    try:
        # Placeholder for actual LLM call
        # response = llm.invoke(...)
        # extracted = json.loads(response.content)
        pass 
    except Exception:
        pass

    # Fallback / Demo logic to ensure the graph progresses even without a live key right this second
    # This makes the "scaffold" functional immediately
    if "Acme" in user_request:
        extracted["client_name"] = "Acme Corp"
    else:
        extracted["client_name"] = "" 
        
    extracted["deal_type"] = "Software License" # Default for demo
    extracted["budget"] = 100000.0 # Default
    extracted["timeline"] = "Q4"
    
    return {
        "client_name": state.get("client_name") or extracted.get("client_name"),
        "deal_type": state.get("deal_type") or extracted.get("deal_type"),
        "budget": state.get("budget") or extracted.get("budget"),
        "timeline": state.get("timeline") or extracted.get("timeline"),
        "current_step": "collect_intent",
        "audit_log": state.get("audit_log", []) + ["Collected intent from user request."]
    }

def fetch_crm(state: ProposalState) -> Dict:
    """Fetches client data from the Mock CRM."""
    print(f"--- Node: fetch_crm ---")
    client_name = state["client_name"]
    if not client_name:
        return {"audit_log": state["audit_log"] + ["Skipped CRM fetch: No client name."]}
        
    data = MockCRM.get_client_data(client_name)
    return {
        "crm_data": data,
        "current_step": "fetch_crm",
        "audit_log": state["audit_log"] + [f"Fetched CRM data for {client_name}."]
    }

def check_missing_info(state: ProposalState) -> Dict:
    """Checks if any required fields are missing."""
    print(f"--- Node: check_missing_info ---")
    required = ["client_name", "deal_type", "budget", "timeline"]
    missing = [field for field in required if not state.get(field)]
    
    return {
        "missing_fields": missing,
        "current_step": "check_missing_info",
        "audit_log": state["audit_log"] + [f"Checked missing info. Missing: {missing}"]
    }

def ask_user(state: ProposalState) -> Dict:
    """Simulates asking the user for missing info (stops execution in main loop typically, but here keeps state)."""
    print(f"--- Node: ask_user ---")
    # In a real agent, this might generate a question string to send back.
    # We will just return, expecting the frontend to see 'missing_fields' and prompt the user.
    return {
        "current_step": "ask_user",
        "audit_log": state["audit_log"] + ["Paused to ask user for missing info."]
    }

def generate_draft(state: ProposalState) -> Dict:
    """Generates the first draft of the proposal."""
    print(f"--- Node: generate_draft ---")
    
    # Template filling
    client = state.get("client_name", "Client")
    budget = state.get("budget", 0)
    timeline = state.get("timeline", "ASAP")
    industry = state.get("crm_data", {}).get("industry", "Business")
    
    draft = f"""
# PROPOSAL FOR {client.upper()}

**Executive Summary**
We are pleased to offer a solution tailored for the {industry} industry. 
Our goal is to meet your timeline of {timeline}.

**Investment**
Total Investment: ${budget:,.2f}

**Terms**
Standard terms apply. 
    """
    
    return {
        "draft_v1": draft,
        "current_step": "generate_draft",
        "audit_log": state["audit_log"] + ["Generated Draft V1."]
    }

def pricing_agent(state: ProposalState) -> Dict:
    """Calculates pricing and checks margins."""
    print(f"--- Node: pricing_agent ---")
    
    deal_type = state.get("deal_type", "Standard")
    budget = state.get("budget", 0)
    client_data = state.get("crm_data", {})
    
    pricing_result = MockPricingEngine.calculate_pricing(deal_type, budget, client_data)
    
    return {
        "pricing": pricing_result,
        "current_step": "pricing_agent",
        "audit_log": state["audit_log"] + ["Calculated pricing strategy."]
    }

def compliance_agent(state: ProposalState) -> Dict:
    """Checks the draft for compliance issues."""
    print(f"--- Node: compliance_agent ---")
    
    draft = state.get("draft_v1", "")
    deal_type = state.get("deal_type", "")
    
    compliance_result = MockComplianceEngine.check_compliance(draft, deal_type)
    
    return {
        "compliance_status": compliance_result,
        "current_step": "compliance_agent",
        "audit_log": state["audit_log"] + [f"Compliance check: {'Passed' if compliance_result['passed'] else 'Issues Found'}."]
    }

def wait_for_approval(state: ProposalState) -> Dict:
    """Sets status to pending approval and halts."""
    print(f"--- Node: wait_for_approval ---")
    return {
        "approval_status": "pending",
        "current_step": "wait_for_approval",
        "audit_log": state["audit_log"] + ["Submitted for Admin Approval."]
    }

def revise_draft(state: ProposalState) -> Dict:
    """Reprises the draft based on approval comments or compliance feedback."""
    print(f"--- Node: revise_draft ---")
    
    # Simple logic: Append comments to the draft for now
    original_draft = state.get("draft_v1", "")
    comments = state.get("approval_comments", "")
    
    revised_draft = original_draft + f"\n\n**Revision Notes**\n{comments}"
    
    return {
        "draft_v2": revised_draft,
        "current_step": "revise_draft",
        "audit_log": state["audit_log"] + ["Revised draft based on feedback."]
    }

def finalize_proposal(state: ProposalState) -> Dict:
    """Finalizes the proposal for sending."""
    print(f"--- Node: finalize_proposal ---")
    
    final_draft = state.get("draft_v2") or state.get("draft_v1")
    
    return {
        "final_draft": final_draft,
        "approval_status": "finalized",
        "current_step": "finalize_proposal",
        "audit_log": state["audit_log"] + ["Proposal Finalized."]
    }
