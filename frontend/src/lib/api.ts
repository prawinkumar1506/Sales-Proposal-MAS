import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export const api = axios.create({
    baseURL: API_BASE,
});

export interface ProposalState {
    user_request: string;
    client_name: string;
    deal_type: string;
    budget: number;
    timeline: string;

    // Comprehensive proposal sections
    proposal_title: string;
    problem_statement: string;
    solution_overview: string;
    architecture_approach: string;
    pricing_details: string;
    compliance_info: string;
    terms_conditions: string;
    conclusion: string;
    
    // Media handling
    uploaded_images: Array<{base64: string, description: string, section: string}>;

    crm_data: any;
    pricing: any;
    compliance_status: any;

    draft_v1: string;
    draft_v2: string;
    final_draft: string;
    proposal: string;

    approval_status: string;
    approval_comments: string;

    missing_fields: string[];
    pending_questions: string[];
    current_question: string;
    current_step: string;
    audit_log: string[];
    finalized_timestamp: string;
    
    proposed_margin?: number;
    proposed_base_cost?: number;
    compliance_issues?: string[];
}

export const endpoints = {
    createProposal: (request: string) => api.post('/proposals/create', { user_request: request }),
    getProposal: (id: string) => api.get(`/proposals/${id}`),
    continueProposal: (id: string, info: any) => api.post(`/proposals/${id}/continue`, { additional_info: info }),
    getPendingApprovals: () => api.get('/admin/pending'),
    adminAction: (id: string, action: 'approve' | 'reject', comments: string) =>
        api.post(`/admin/${id}/action`, { action, comments }),
    getFinalizedProposal: (id: string) => api.get(`/proposals/${id}/finalized`),
};
