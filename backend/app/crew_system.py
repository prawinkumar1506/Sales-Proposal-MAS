import os
import json
import logging
import re
from typing import Dict, Any, Optional, List
from langchain_groq import ChatGroq
from .mocks import MockCRM, MockPricingEngine, MockComplianceEngine

logger = logging.getLogger(__name__)

# Initialize LLM
llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0.7)

# In-memory storage for proposals
proposals_store: Dict[str, Dict] = {}


def extract_info_from_text(text: str, existing_data: Dict) -> Dict:
    """Extract proposal information from user text using LLM."""
    system = """You are a smart sales assistant analyzing a proposal conversation. Extract the following information from the user's message:
    
    Basic Info:
    - client_name: Name of the company/client (e.g., if user says "X is my company" or "proposal for X", extract X)
    - deal_type: Type of deal (e.g. Software, Consulting, Implementation, Product Launch, Partnership, Service Engagement)
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
    
    IMPORTANT EXTRACTION RULES:
    - For client_name: Look for phrases like "X is my company", "company is X", "proposal for X", "client is X"
    - Extract the actual company name, not pronouns like "that", "this", "it"
    - Only extract NEW information. Don't overwrite existing fields unless user provides new info.
    
    Return ONLY valid JSON. Use null for missing values. Do NOT wrap in markdown code blocks.
    """
    
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    existing_info = "\n".join([f"- {k}: {v}" for k, v in existing_data.items() if v])
    human = f"""Existing Information:
{existing_info if existing_info else "None"}

New User Request: {text}

Extract only NEW information from the user's request. Return JSON with only the fields that have new information."""
    
    prompt = ChatPromptTemplate.from_messages([("system", system), ("human", human)])
    chain = prompt | llm | StrOutputParser()
    
    extracted = {}
    try:
        response = chain.invoke({})
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        extracted = json.loads(json_str)
        logger.info(f"Extracted from LLM: {extracted}")
        
        # Post-process budget if it's a string like "50k"
        if extracted.get("budget") and isinstance(extracted["budget"], str):
            budget_str = extracted["budget"].lower().strip()
            try:
                if budget_str.endswith("k") or budget_str.endswith("thousand"):
                    num = float(budget_str.replace("k", "").replace("thousand", "").strip())
                    extracted["budget"] = int(num * 1000)
                elif budget_str.endswith("m") or budget_str.endswith("million"):
                    num = float(budget_str.replace("m", "").replace("million", "").strip())
                    extracted["budget"] = int(num * 1000000)
                else:
                    # Try to parse as number
                    extracted["budget"] = float(budget_str.replace(",", "").replace("$", "").strip())
            except:
                pass  # Keep original if parsing fails
    except Exception as e:
        logger.error(f"LLM Extraction failed: {e}")
        # Fallback pattern matching
        extracted = fallback_extraction(text)
    
    # Merge with existing data
    result = existing_data.copy()
    for key, value in extracted.items():
        if value is not None and value != "":
            result[key] = value
    
    return result


def fallback_extraction(text: str) -> Dict:
    """Fallback pattern-based extraction."""
    extracted = {}
    pronouns = r'\b(that|this|it|them|those|these)\b'
    
    # Extract client_name
    patterns = [
        r"([A-Z][A-Za-z\s&.,-]+?)\s+is\s+(?:my|the|our)\s+(?:company|client|organization|business)",
        r"(?:company|client|organization|business)\s+is\s+([A-Z][A-Za-z\s&.,-]+)",
        r"proposal\s+for\s+([A-Z][A-Za-z\s&.,-]+(?:Ltd|Inc|Corp|LLC|Pvt|Limited|Company|Corporation)?)",
        r"for\s+([A-Z][A-Za-z]{2,}[\s&.,-]*(?:Ltd|Inc|Corp|LLC|Pvt|Limited|Company|Corporation)?)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            potential_name = match.group(1).strip().rstrip('.')
            if (len(potential_name) > 2 and 
                not re.match(pronouns, potential_name, re.IGNORECASE) and
                potential_name.lower() not in ['that', 'this', 'it', 'them', 'those', 'these']):
                extracted["client_name"] = potential_name
                break
    
    # Extract budget (e.g., "50k", "$50k", "50 thousand")
    budget_patterns = [
        r"\$?(\d+(?:,\d{3})*)\s*(?:k|thousand|K)",
        r"budget\s+(?:of\s+)?\$?(\d+(?:,\d{3})*)\s*(?:k|thousand|K)?",
        r"\$(\d+(?:,\d{3})*)",
    ]
    for pattern in budget_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            budget_str = match.group(1).replace(",", "")
            try:
                budget_val = float(budget_str)
                if "k" in match.group(0).lower() or "thousand" in match.group(0).lower():
                    budget_val *= 1000
                extracted["budget"] = int(budget_val)
                break
            except:
                pass
    
    return extracted


def check_missing_fields(data: Dict) -> List[str]:
    """Check which required fields are missing."""
    required = ["client_name", "deal_type", "budget", "timeline"]
    missing = [field for field in required if not data.get(field)]
    return missing


def generate_question(missing_fields: List[str], data: Dict) -> str:
    """Generate a question for missing fields."""
    if not missing_fields:
        return "I have all the info. Should I generate the draft?"
    
    field = missing_fields[0]
    question_map = {
        "client_name": "What is the name of the client or company for this proposal?",
        "deal_type": "What type of deal or service are we proposing? (e.g., Software, Consulting, Implementation)",
        "budget": "What is the budget or investment amount for this project?",
        "timeline": "What is the timeline or deadline for this project?",
    }
    
    return question_map.get(field, f"What is the {field.replace('_', ' ')}?")


def process_proposal(thread_id: str, user_input: str) -> Dict:
    """Process a proposal request using CrewAI."""
    # Get or create proposal state
    if thread_id not in proposals_store:
        proposals_store[thread_id] = {
            "user_request": user_input,
            "audit_log": [f"Proposal started with request: {user_input}"],
            "current_step": "collecting_info",
            "missing_fields": [],
            "current_question": None,
            "budget": None,
            "client_name": None,
            "deal_type": None,
            "timeline": None,
            "proposal_title": None,
            "problem_statement": None,
            "solution_overview": None,
            "architecture_approach": None,
            "pricing_details": None,
            "compliance_info": None,
            "terms_conditions": None,
            "conclusion": None,
            "uploaded_images": [],
            "crm_data": None,
            "pricing": None,
            "compliance_status": None,
            "draft_v1": None,
            "draft_v2": None,
            "final_draft": None,
            "approval_status": None,
            "approval_comments": None,
            "proposed_margin": None,
            "proposed_base_cost": None,
            "compliance_issues": None,
        }
    
    state = proposals_store[thread_id]
    
    # Extract information from user input
    existing_data = {
        "client_name": state.get("client_name"),
        "deal_type": state.get("deal_type"),
        "budget": state.get("budget"),
        "timeline": state.get("timeline"),
    }
    
    extracted = extract_info_from_text(user_input, existing_data)
    
    # Update state with extracted data
    for key in ["client_name", "deal_type", "budget", "timeline"]:
        if extracted.get(key):
            state[key] = extracted[key]
    
    state["audit_log"].append(f"Processed user input: {user_input[:100]}...")
    
    # Check for missing fields
    missing = check_missing_fields(state)
    state["missing_fields"] = missing
    
    # If we have client_name, fetch CRM data
    if state.get("client_name") and not state.get("crm_data"):
        client_name = state["client_name"]
        state["crm_data"] = MockCRM.get_client_data(client_name)
        state["audit_log"].append(f"Fetched CRM data for {client_name}")
    
    # Determine next step
    if missing:
        # Still missing info - ask user
        state["current_step"] = "ask_user"
        state["current_question"] = generate_question(missing, state)
        state["audit_log"].append(f"Asked user: {state['current_question']}")
    else:
        # All info collected - generate draft
        try:
            state["current_step"] = "generating_draft"
            draft = generate_draft(state)
            state["draft_v1"] = draft
            
            # Run pricing and compliance
            state["current_step"] = "pricing_review"
            pricing_result = MockPricingEngine.calculate_pricing(
                state.get("deal_type", "Standard"),
                state.get("budget", 0),
                state.get("crm_data", {})
            )
            state["pricing"] = pricing_result
            state["proposed_margin"] = pricing_result.get("margin")
            state["proposed_base_cost"] = pricing_result.get("base_cost")
            
            compliance_result = MockComplianceEngine.check_compliance(
                draft,
                state.get("deal_type", "")
            )
            state["compliance_status"] = compliance_result
            state["compliance_issues"] = compliance_result.get("issues", [])
            
            state["current_step"] = "wait_for_approval"
            state["approval_status"] = "pricing_review"
            state["audit_log"].append("Submitted for Admin Review (Pricing, Margin, Compliance Approval)")
        except Exception as e:
            logger.error(f"Error generating draft: {str(e)}")
            state["current_step"] = "error"
            state["audit_log"].append(f"Error during draft generation: {str(e)}")
            state["current_question"] = "I encountered an error while generating the proposal. Please try again or contact support."
    
    return state


def generate_draft(state: Dict) -> str:
    """Generate proposal draft."""
    client = state.get("client_name", "Client")
    deal_type = state.get("deal_type", "Service")
    budget = state.get("budget", 0)
    timeline = state.get("timeline", "ASAP")
    industry = state.get("crm_data", {}).get("industry", "Business")
    
    # Ensure all fields have default values (handle None)
    proposal_title = state.get("proposal_title") or f"Proposal for {client}"
    problem_statement = state.get("problem_statement") or "Addressing client business needs"
    solution_overview = state.get("solution_overview") or "Comprehensive solution approach"
    architecture_approach = state.get("architecture_approach") or "Technical implementation strategy"
    pricing_details = state.get("pricing_details") or f"Total investment: ${budget:,.2f}"
    compliance_info = state.get("compliance_info") or "Standard compliance requirements"
    terms_conditions = state.get("terms_conditions") or "Standard terms and conditions"
    conclusion = state.get("conclusion") or "Next steps and call to action"
    
    draft = f"""# {proposal_title.upper()}

## Executive Summary
We are pleased to present this comprehensive proposal for {client}, a leading {industry} organization. This document outlines our strategic approach to addressing your specific needs through our {deal_type} solution, designed to deliver exceptional value within your {timeline} timeline.

**Proposal Validity**: This proposal is valid for 30 days from submission
**Target Timeline**: {timeline}
**Industry Focus**: {industry}

## Problem Statement
{problem_statement}

## Solution Overview
{solution_overview}

## Architecture & Approach
{architecture_approach}

## Timeline & Implementation
**Project Timeline**: {timeline}
**Implementation Strategy**: Phased approach with regular milestones
**Key Deliverables**: Complete solution deployment and training

## Pricing & Investment
{pricing_details}

**Payment Terms**: Net 30 (standard)
**Included Services**: Implementation, training, and 12-month support

## Compliance & Requirements
{compliance_info}

## Terms & Conditions
{terms_conditions}

## Conclusion
{conclusion}

---
**Next Steps**: Upon approval, we will schedule a kickoff meeting within 5 business days to begin the implementation process.

**Note**: This proposal requires internal review and approval before finalization. All terms are subject to standard governance procedures.
    """
    
    return draft


def finalize_proposal(thread_id: str, approval_comments: str = "") -> Dict:
    """Finalize proposal after admin approval."""
    if thread_id not in proposals_store:
        raise ValueError(f"Proposal {thread_id} not found")
    
    state = proposals_store[thread_id]
    
    # Add approval comments to draft
    original_draft = state.get("draft_v1", "")
    revised_draft = original_draft + f"\n\n## Admin Review & Approval Notes\n{approval_comments}\n**Status**: Approved for finalization."
    
    state["draft_v2"] = revised_draft
    state["final_draft"] = revised_draft
    state["approval_status"] = "finalized"
    state["current_step"] = "finalized"
    state["approval_comments"] = approval_comments
    state["audit_log"].append("Proposal Finalized and Ready to Send.")
    
    return state
