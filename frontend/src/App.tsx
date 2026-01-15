import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { CopilotChat } from './components/CopilotChat';
import { ProposalViewer } from './components/ProposalViewer';
import { ContextPanel } from './components/ContextPanel';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginPage } from './components/LoginPage';
import type { ProposalState } from './lib/api';
import { endpoints } from './lib/api';
import { LayoutGrid, FileText, ShieldCheck } from 'lucide-react';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

const SalesInterface: React.FC = () => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [state, setState] = useState<Partial<ProposalState>>({});
  const [messages, setMessages] = useState<string[]>(["Agent: Hello! I'm your Northstar Proposal Agent. Who is the proposal for?"]);
  const [loading, setLoading] = useState(false);

  // Polling for updates
  useEffect(() => {
    if (!threadId) return;

    const poll = async () => {
      try {
        const res = await endpoints.getProposal(threadId);
        setState(res.data.state);
        
        // If proposal is finalized, fetch the complete finalized proposal
        if (res.data.state.approval_status === 'finalized') {
          try {
            const finalizedRes = await endpoints.getFinalizedProposal(threadId);
            setState(prev => ({ ...prev, ...finalizedRes.data }));
          } catch (e: any) {
            console.error("Error fetching finalized proposal:", e);
            // If finalized proposal endpoint fails, show a user-friendly message
            if (e.response?.status === 400) {
              setMessages(prev => [...prev, "Agent: Proposal is finalized but having trouble loading the complete data. Please refresh the page."]);
            } else {
              setMessages(prev => [...prev, "Agent: Having trouble connecting to the server. Please try again later."]);
            }
          }
        }
      } catch (e: any) {
        console.error("Polling error", e);
        // Handle different error scenarios
        if (e.response?.status === 404) {
          setMessages(prev => [...prev, "Agent: Proposal not found. Please start a new proposal."]);
          setThreadId(null);
          setState({});
        } else if (e.response?.status >= 500) {
          setMessages(prev => [...prev, "Agent: Server is experiencing issues. Please try again later."]);
        }
      }
    };

    const interval = setInterval(poll, 2000); // 2s polling
    return () => clearInterval(interval);
  }, [threadId]);

  const handleSendMessage = async (msg: string, image?: string) => {
    if (!msg.trim() && !image) return;

    // Add user message
    setMessages(prev => [...prev, `User: ${msg || "[Image shared]"}`]);
    setLoading(true);

    try {
      if (!threadId) {
        // Start new proposal
        const res = await endpoints.createProposal(msg);
        setThreadId(res.data.id);
        setState(res.data.state);
        
        // Add agent response based on current question
        if (res.data.state.current_question) {
          setMessages(prev => [...prev, `Agent: ${res.data.state.current_question}`]);
        }
      } else {
        // Continue conversation
        const updatePayload: any = { response: msg };
        if (image) {
          updatePayload.image_base64 = image;
          updatePayload.image_note = "[Image analyzed]";
        }

        const res = await endpoints.continueProposal(threadId, updatePayload);
        setState(res.data.state);

        // Add agent's next response
        if (res.data.state.current_step === 'ask_user' && res.data.state.current_question) {
          setMessages(prev => [...prev, `Agent: ${res.data.state.current_question}`]);
        } else if (res.data.state.current_step === 'wait_for_approval') {
          setMessages(prev => [...prev, `Agent: Proposal analysis complete! Pricing and compliance details have been sent to admin for approval. Awaiting authorization...`]);
        } else if (res.data.state.approval_status === 'finalized') {
          setMessages(prev => [...prev, `Agent: Proposal has been finalized and is ready to send!`]);
        }
      }
    } catch (e) {
      console.error("Error:", e);
      setMessages(prev => [...prev, `Agent: I encountered an error. Please try again.`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar / Nav */}
      <div className="w-20 bg-[#0F172A] flex flex-col items-center py-6 gap-6 z-20 shadow-xl">
        <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-900/50 mb-4">
          <LayoutGrid size={24} />
        </div>
        <Link to="/" className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="Sales Copilot">
          <FileText size={24} />
        </Link>
        <Link to="/admin" className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="Admin Dashboard">
          <ShieldCheck size={24} />
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="w-[400px] flex flex-col h-full border-r border-slate-200 bg-white z-10 shadow-sm">
          <CopilotChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={loading || state.current_step === 'pricing_agent' || state.current_step === 'compliance_agent'}
          />
          {state.missing_fields && state.missing_fields.length > 0 && (
            <div className="bg-amber-50/50 p-3 text-xs font-semibold text-amber-700 text-center border-t border-amber-100 backdrop-blur-sm">
              Waiting for: {state.missing_fields.join(", ")}
            </div>
          )}
        </div>

        {/* Center: Proposal */}
        <div className="flex-1 h-full overflow-hidden relative bg-slate-50/50">
          <ProposalViewer 
            draft={state.draft_v2 || state.draft_v1 || ""} 
            status={state.approval_status || "draft"} 
            finalizedData={state.approval_status === 'finalized' ? {
              proposal: state.proposal || state.final_draft || state.draft_v2 || state.draft_v1 || "",
              client_name: state.client_name || "",
              deal_type: state.deal_type || "",
              budget: state.budget || 0,
              timeline: state.timeline || "",
              pricing: state.pricing || {},
              compliance_status: state.compliance_status || "approved",
              finalized_timestamp: state.finalized_timestamp || ""
            } : undefined}
          />

          {/* Blocking Overlay for Approval */}
          {state.current_step === "wait_for_approval" && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-500">
              <div className="text-center p-10 bg-white/90 shadow-2xl rounded-3xl border border-slate-100 max-w-lg">
                <div className="inline-flex p-5 bg-amber-50 text-amber-500 rounded-full mb-6 ring-4 ring-amber-50/50">
                  <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Admin Approval Required</h3>
                <p className="text-slate-500 leading-relaxed">
                  This proposal exceeds standard parameters.<br />
                  It has been routed to the compliance team for review.
                </p>
                <div className="mt-8 flex justify-center">
                  <span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-mono font-medium animate-pulse">
                    STATUS: LOCKED
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Context */}
        <div className="w-80 h-full border-l border-slate-200 bg-white shadow-sm z-10">
          <ContextPanel
            crmData={state.crm_data}
            pricing={state.pricing}
            compliance={state.compliance_status}
            auditLog={state.audit_log || []}
          />
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SalesInterface />} />
        <Route path="/admin" element={<LoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
