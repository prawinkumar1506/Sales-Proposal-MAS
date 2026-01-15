import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
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
        // Only update if changed (simple check) to avoid flicker if we had deep comparison
        // For demo, just set it.
        setState(res.data.state);
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    const interval = setInterval(poll, 1000); // 1s polling
    return () => clearInterval(interval);
  }, [threadId]);

  const handleSendMessage = async (msg: string) => {
    setMessages(prev => [...prev, `User: ${msg}`]);
    setLoading(true);

    try {
      if (!threadId) {
        // Start new
        const res = await endpoints.createProposal(msg);
        setThreadId(res.data.id);
        setState(res.data.state);
        setMessages(prev => [...prev, `Agent: Started proposal. ID: ${res.data.id.slice(0, 4)}...`]);
      } else {
        const missing = state.missing_fields || [];
        const updatePayload: any = {};

        if (missing.length > 0) {
          const field = missing[0];
          if (field === "budget") {
            updatePayload[field] = parseFloat(msg) || 0;
          } else {
            updatePayload[field] = msg;
          }
          setMessages(prev => [...prev, `Agent: Received ${field}.`]);
        } else {
          setMessages(prev => [...prev, `Agent: Processing input...`]);
        }

        await endpoints.continueProposal(threadId, updatePayload);
      }
    } catch (e) {
      setMessages(prev => [...prev, `Agent: Error communicating with server.`]);
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
          <ProposalViewer draft={state.draft_v2 || state.draft_v1 || ""} status={state.approval_status || "draft"} />

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
