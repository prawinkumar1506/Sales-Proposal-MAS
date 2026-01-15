from typing import TypedDict, List, Dict, Optional

class ProposalState(TypedDict):
    user_request: str
    client_name: Optional[str]
    deal_type: Optional[str]
    budget: Optional[float]
    timeline: Optional[str]

    # Comprehensive proposal sections
    proposal_title: Optional[str]
    problem_statement: Optional[str]
    solution_overview: Optional[str]
    architecture_approach: Optional[str]
    pricing_details: Optional[str]
    compliance_info: Optional[str]
    terms_conditions: Optional[str]
    conclusion: Optional[str]
    
    # Media handling
    uploaded_images: List[Dict]  # List of {base64: str, description: str, section: str}
    
    crm_data: Optional[Dict]
    pricing: Optional[Dict]
    compliance_status: Optional[Dict]

    draft_v1: Optional[str]
    draft_v2: Optional[str]
    final_draft: Optional[str]

    approval_status: Optional[str]  # pending / approved / rejected / pricing_review
    approval_comments: Optional[str]

    missing_fields: List[str]
    pending_questions: List[str]  # Questions waiting for user response
    current_question: Optional[str]  # Currently asked question
    current_step: str
    audit_log: List[str]
    
    # Pricing and compliance details for admin review
    proposed_margin: Optional[float]
    proposed_base_cost: Optional[float]
    compliance_issues: Optional[List[str]]
