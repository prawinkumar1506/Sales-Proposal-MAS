from typing import TypedDict, List, Dict, Optional

class ProposalState(TypedDict):
    user_request: str
    client_name: str
    deal_type: str
    budget: float
    timeline: str

    crm_data: Dict
    pricing: Dict
    compliance_status: Dict

    draft_v1: str
    draft_v2: str
    final_draft: str

    approval_status: str  # pending / approved / rejected
    approval_comments: str

    missing_fields: List[str]
    current_step: str
    audit_log: List[str]
