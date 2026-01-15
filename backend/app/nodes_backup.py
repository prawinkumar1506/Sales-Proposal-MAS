
import os
import json
from typing import Dict, Any, Optional, List
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .state import ProposalState
from .mocks import MockCRM, MockPricingEngine, MockComplianceEngine

# Initialize LLM
llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0.7)

def route_start(state: ProposalState):
    """Entry router to decide where to go based on current step."""
    step = state.get("current_step")
    if step == "collect_intent" or step == "check_missing_info" or step == "ask_user":
        # Resume asking questions/collecting intent
        return "collect_intent"
    elif step == "review_proposal":
        # Resume to handle feedback
        return "handle_feedback"
    else:
        # Default start
        return "collect_intent"


def collect_intent(state: ProposalState) -> Dict:
    """Analyzes the user request to extract intent and comprehensive proposal information."""
    print(f"--- Node: collect_intent ---")
    user_request = state.get("user_request", "")
    
    # DEBUG: Check if API Key works
    if not os.environ.get("GROQ_API_KEY"):
        print("CRITICAL ERROR: GROQ_API_KEY is missing in environment!")
    
    # Enhanced prompt for comprehensive proposal extraction
    system = """You are a smart sales assistant analyzing a proposal request. Extract the following information from the user's message:
    
    Basic Info:
    - client_name: Name of the company/client
    - deal_type: Type of deal (e.g. Software, Consulting, Implementation)
    - budget: Budget amount (number)
    - timeline: Timeline (e.g. Q1, ASAP, 3 months)
    
    Proposal Sections (extract if mentioned):
    - proposal_title: Title of the proposal
    - problem_statement: Problem being solved
    - solution_overview: High-level solution description
    - architecture_approach: Technical architecture or approach
    - pricing_details: Pricing information
    - compliance_info: Compliance requirements
    - terms_conditions: Terms and conditions
    - conclusion: Conclusion or next steps
    
    Return ONLY valid JSON. Use null for missing values. Do NOT wrap in markdown code blocks.
    Format: {"client_name": ..., "deal_type": ..., "budget": ..., "timeline": ..., "proposal_title": ..., "problem_statement": ..., "solution_overview": ..., "architecture_approach": ..., "pricing_details": ..., "compliance_info": ..., "terms_conditions": ..., "conclusion": ...}
    """
    human = f"User Request: {user_request}"
    prompt = ChatPromptTemplate.from_messages([("system", system), ("human", human)])
    chain = prompt | llm | StrOutputParser()
    
    extracted = {}
    try:
        response = chain.invoke({})
        print(f"DEBUG LLM Response (Extraction): {response}")
        
        # Cleanup markdown if present
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
            
        extracted = json.loads(json_str)
        print(f"DEBUG Extracted JSON: {extracted}")
        
    except Exception as e:
        print(f"ERROR: LLM Extraction failed: {e}")
        # Proceed with empty extracted to rely on state
        pass

    # Merge extracted info with existing state
    updates = {}
    
    # Basic info
    for field in ["client_name", "deal_type", "budget", "timeline"]:
        if extracted.get(field):
            updates[field] = extracted[field]
    
    # Proposal sections
    for field in ["proposal_title", "problem_statement", "solution_overview", "architecture_approach", 
                  "pricing_details", "compliance_info", "terms_conditions", "conclusion"]:
        if extracted.get(field):
            updates[field] = extracted[field]
    
    # Handle image uploads if present
    if "image_base64" in state and "image_note" in state:
        image_data = {
            "base64": state["image_base64"],
            "description": state["image_note"],
            "section": "general"  # Will be categorized later
        }
        updates["uploaded_images"] = state.get("uploaded_images", []) + [image_data]
    
    updates["current_step"] = "check_missing_info"
    updates["audit_log"] = state.get("audit_log", []) + [f"Collected intent from user request: {user_request[:100]}..."]
    
    return updates

def fetch_crm(state: ProposalState) -> Dict:
    """Fetches client data from the Mock CRM."""
    print(f"--- Node: fetch_crm ---")
    client_name = state.get("client_name")
    if not client_name:
        return {"audit_log": state.get("audit_log", []) + ["Client name is missing."]}
        
    data = MockCRM.get_client_data(client_name)
    return {
        "crm_data": data,
        "current_step": "fetch_crm",
        "audit_log": state.get("audit_log", []) + [f"Fetched CRM data for {client_name}."]
    }

def check_missing_info(state: ProposalState) -> Dict:
    """Checks for missing basic info and comprehensive proposal sections."""
    print(f"--- Node: check_missing_info ---")
    
    # Basic required fields
    basic_required = ["client_name", "deal_type", "budget", "timeline"]
    
    # Comprehensive proposal sections
    proposal_sections = ["proposal_title", "problem_statement", "solution_overview", 
                        "architecture_approach", "pricing_details", "compliance_info", 
                        "terms_conditions", "conclusion"]
    
    missing = []
    
    # Check basic fields
    for field in basic_required:
        if not state.get(field):
            missing.append(field)
    
    # Check proposal sections - only add to missing if we have basic info
    if not missing:  # Only check proposal sections if basic info is complete
        for section in proposal_sections:
            if not state.get(section):
                missing.append(section)
    
    print(f"DEBUG Missing Fields: {missing}")
    
    return {
        "missing_fields": missing,
        "current_step": "check_missing_info",
        "audit_log": state.get("audit_log", []) + [f"Checked for missing info. Missing: {missing}"]
    }

def ask_user(state: ProposalState) -> Dict:
    """Generates dynamic questions for missing basic info and comprehensive proposal sections."""
    print(f"--- Node: ask_user ---")
    missing = state.get("missing_fields", [])
    user_request = state.get("user_request", "")
    
    if not missing:
        # Should not happen if routed correctly, but safe fallback
        return {
            "current_step": "ask_user",
            "current_question": "I have all the info. Should I generate the draft?",
            "audit_log": state.get("audit_log", [])
        }
    
    # Enhanced prompt for comprehensive proposal sections
    system = f"""You are 'Northstar', an intelligent and friendly sales agent.
    
    Current Information:
    - Client: {state.get("client_name") or "Unknown"}
    - Deal Type: {state.get("deal_type") or "Unknown"}
    - Budget: {state.get("budget") or "Unknown"}
    - Timeline: {state.get("timeline") or "Unknown"}
    
    Missing Information: {', '.join(missing)}
    
    The user just said: "{user_request}"
    
    Your Goal:
    1. If the user provided new info, acknowledge it briefly
    2. Ask for the NEXT missing piece of information ({missing[0]})
    3. Be conversational and specific
    4. For proposal sections, ask detailed questions
    5. Mention they can upload images if relevant
    6. Keep it concise but engaging
    
    Question Examples:
    - For proposal_title: "What would you like to title this proposal?"
    - For problem_statement: "What specific problem are we solving for the client?"
    - For solution_overview: "Can you describe the high-level solution approach?"
    - For architecture_approach: "What's the technical architecture or methodology we'll use?"
    - For pricing_details: "How should we structure the pricing breakdown?"
    - For compliance_info: "Are there any specific compliance requirements?"
    - For terms_conditions: "What terms and conditions should we include?"
    - For conclusion: "What should be the main takeaway or call to action?"
    """
    
    prompt = ChatPromptTemplate.from_messages([("system", system)])
    chain = prompt | llm | StrOutputParser()
    
    try:
        question = chain.invoke({})
        print(f"DEBUG LLM Question: {question}")
    except Exception as e:
        print(f"ERROR: LLM Question Generation failed: {e}")
        # Comprehensive fallback questions
        field = missing[0]
        question_map = {
            "client_name": "Who is the client for this proposal?",
            "deal_type": "What kind of deal or service are we proposing?",
            "budget": "Do you have a specific budget in mind?",
            "timeline": "When are you looking to start this project?",
            "proposal_title": "What would you like to title this proposal?",
            "problem_statement": "What specific problem are we solving for the client?",
            "solution_overview": "Can you describe the high-level solution approach?",
            "architecture_approach": "What's the technical architecture or methodology we'll use?",
            "pricing_details": "How should we structure the pricing breakdown?",
            "compliance_info": "Are there any specific compliance requirements we need to address?",
            "terms_conditions": "What terms and conditions should we include?",
            "conclusion": "What should be the main takeaway or call to action?"
        }
        question = question_map.get(field, f"Can you tell me more about {field.replace('_', ' ')}?")
    
    return {
        "current_step": "ask_user",
        "current_question": question,
        "audit_log": state.get("audit_log", []) + [f"Asked user: {question}"]
    }

def generate_draft(state: ProposalState) -> Dict:
    """Generates a comprehensive draft using all collected proposal sections."""
    print(f"--- Node: generate_draft ---")
    
    # Get all the comprehensive information
    client = state.get("client_name", "Client")
    deal_type = state.get("deal_type", "Service")
    budget = state.get("budget", 0)
    timeline = state.get("timeline", "ASAP")
    industry = state.get("crm_data", {}).get("industry", "Business")
    
    # Proposal sections
    proposal_title = state.get("proposal_title", f"Proposal for {client}")
    problem_statement = state.get("problem_statement", "Addressing client business needs")
    solution_overview = state.get("solution_overview", "Comprehensive solution approach")
    architecture_approach = state.get("architecture_approach", "Technical implementation strategy")
    pricing_details = state.get("pricing_details", f"Total investment: ${budget:,.2f}")
    compliance_info = state.get("compliance_info", "Standard compliance requirements")
    terms_conditions = state.get("terms_conditions", "Standard terms and conditions")
    conclusion = state.get("conclusion", "Next steps and call to action")
    
    # Handle uploaded images
    uploaded_images = state.get("uploaded_images", [])
    image_references = ""
    if uploaded_images:
        image_references = "\n\n## Attachments & Visual References\n"
        for i, img in enumerate(uploaded_images, 1):
            image_references += f"- Image {i}: {img.get('description', 'Uploaded image')}\n"
    
    # Generate comprehensive draft
    draft = f"""# {proposal_title.upper()}
        "audit_log": state.get("audit_log", [])
    }

def review_proposal(state: ProposalState) -> Dict:
    """Presents the proposal to the user for review before admin."""
    print(f"--- Node: review_proposal ---")
    
    # Dynamic review message
    msg = "I've generated a draft proposal based on your requirements. Please review the document. If it looks good, just say 'Approve' or 'Proceed'. If you need any changes, let me know!"
    
    return {
        "current_question": msg,
        "current_step": "review_proposal",
        "audit_log": state.get("audit_log", []) + ["Presented draft to user for review."]
    }

def handle_feedback(state: ProposalState) -> Dict:
    """Routes based on user review feedback."""
    print(f"--- Node: handle_feedback ---")
    last_msg = state.get("user_request", "").lower()
    
    # Simple keyword matching for approval
    if "approve" in last_msg or "looks good" in last_msg or "proceed" in last_msg or "yes" in last_msg:
         return {
             "approval_status": "user_approved",
             "current_step": "handle_feedback",
             "audit_log": state.get("audit_log", []) + ["User approved draft. Proceeding to admin."]
         }
    else:
        # If feedback involves changes, we might want to feed that back into 'collect_intent' logic implicitly
        # The 'collect_intent' node will run next and should pick up changes if the user says "Change budget to 50k"
        return {
             "current_step": "handle_feedback",
             "audit_log": state.get("audit_log", []) + ["User requested changes/feedback."]
         }

def wait_for_approval(state: ProposalState) -> Dict:
    """Sets status to pending admin approval. All proposals with pricing/compliance go here."""
    print(f"--- Node: wait_for_approval ---")
    return {
        "approval_status": "pricing_review",
        "current_step": "wait_for_approval",
        "audit_log": state.get("audit_log", []) + [
            "Submitted for Admin Review (Pricing, Margin, Compliance Approval)."
        ]
    }

def revise_draft(state: ProposalState) -> Dict:
    """Revises the draft based on approval comments of compliance feedback."""
    print(f"--- Node: revise_draft ---")
    original_draft = state.get("draft_v1", "")
    comments = state.get("approval_comments", "")
    
    revised_draft = original_draft + f"\n\n## Admin Review & Approval Notes\n{comments}\n**Status**: Approved for finalization."
    
    return {
        "draft_v2": revised_draft,
        "current_step": "revise_draft",
        "audit_log": state.get("audit_log", []) + ["Revised draft based on admin approval feedback."]
    }

def finalize_proposal(state: ProposalState) -> Dict:
    """Finalizes the proposal for sending."""
    print(f"--- Node: finalize_proposal ---")
    final_draft = state.get("draft_v2") or state.get("draft_v1")
    return {
        "final_draft": final_draft,
        "approval_status": "finalized",
        "current_step": "finalize_proposal",
        "audit_log": state.get("audit_log", []) + ["Proposal Finalized and Ready to Send."]    
    }