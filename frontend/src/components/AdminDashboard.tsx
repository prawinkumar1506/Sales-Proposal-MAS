import React, { useEffect, useState } from 'react';
import { endpoints } from '../lib/api';
import { Check, X, AlertCircle, LogOut, CheckCircle2, DollarSign, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminDashboard: React.FC = () => {
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchPending = async () => {
        setLoading(true);
        try {
            const res = await endpoints.getPendingApprovals();
            // Fetch detailed state for each pending proposal
            const detailed = await Promise.all(
                res.data.map(async (item: any) => {
                    try {
                        const stateRes = await endpoints.getProposal(item.id);
                        return { ...item, ...stateRes.data.state };
                    } catch {
                        return item;
                    }
                })
            );
            setPending(detailed);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
        const interval = setInterval(fetchPending, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('isAdmin');
        navigate('/admin');
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        const defaultMessage = action === 'approve' 
            ? "Approved. Pricing parameters and compliance requirements accepted."
            : "Rejected. Please provide details on why this proposal does not meet our standards.";
        
        const comments = prompt(`${action.toUpperCase()} PROPOSAL\n\nEnter your comments:`, defaultMessage);
        if (comments === null) return;

        try {
            await endpoints.adminAction(id, action, comments);
            setPending(current => current.filter(p => p.id !== id));
            fetchPending();
        } catch (e) {
            alert("Error performing action");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Governance Dashboard</h1>
                        <p className="text-slate-500 mt-1">Review proposals for pricing, margin, and compliance approval.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={fetchPending} className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                            Refresh Queue
                        </button>
                        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </header>

                {loading && pending.length === 0 && (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                    </div>
                )}

                <div className="space-y-4">
                    <AnimatePresence>
                        {pending.length === 0 && !loading ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white p-16 rounded-2xl shadow-sm text-center text-slate-400 border border-slate-100"
                            >
                                <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 size={40} className="text-green-500" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-700 mb-2">All Clear</h3>
                                <p>No proposals are currently awaiting approval.</p>
                            </motion.div>
                        ) : (
                            pending.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden group hover:shadow-xl transition-all duration-300"
                                >
                                    <div className="p-8">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-800 mb-1">{item.client_name || "Untitled Client"}</h3>
                                                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{item.id}</span>
                                            </div>
                                            <div className="px-4 py-1.5 bg-amber-50 text-amber-600 text-xs font-bold uppercase tracking-wider rounded-full border border-amber-100 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Pending Review
                                            </div>
                                        </div>

                                        {/* Pricing & Compliance Details */}
                                        <div className="grid grid-cols-2 gap-6 mb-8">
                                            {/* Pricing Section */}
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 p-6 rounded-xl border border-blue-100">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <DollarSign className="text-blue-600" size={20} />
                                                    <h4 className="font-bold text-slate-800">Pricing Parameters</h4>
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-xs text-slate-500 uppercase font-semibold">Budget</p>
                                                        <p className="text-lg font-bold text-slate-800">${item.budget?.toLocaleString() || "N/A"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 uppercase font-semibold">Base Cost</p>
                                                        <p className="text-lg font-bold text-slate-800">${item.proposed_base_cost?.toLocaleString() || "N/A"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 uppercase font-semibold">Proposed Margin</p>
                                                        <p className={`text-lg font-bold ${item.proposed_margin && item.proposed_margin > 0.2 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {item.proposed_margin ? `${(item.proposed_margin * 100).toFixed(1)}%` : "N/A"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Compliance Section */}
                                            <div className="bg-gradient-to-br from-purple-50 to-purple-50/30 p-6 rounded-xl border border-purple-100">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Shield className="text-purple-600" size={20} />
                                                    <h4 className="font-bold text-slate-800">Compliance Status</h4>
                                                </div>
                                                {item.compliance_issues && item.compliance_issues.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {item.compliance_issues.map((issue: string, idx: number) => (
                                                            <div key={idx} className="flex gap-2 text-sm">
                                                                <AlertCircle className="text-amber-500 flex-shrink-0" size={16} />
                                                                <span className="text-slate-700">{issue}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 text-sm text-green-700">
                                                        <Check className="text-green-600 flex-shrink-0" size={16} />
                                                        <span>All compliance requirements met</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Proposal Details */}
                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8">
                                            <h4 className="font-bold text-slate-800 mb-4">Deal Details</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Deal Type</p>
                                                    <p className="text-slate-800 font-medium">{item.deal_type || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Timeline</p>
                                                    <p className="text-slate-800 font-medium">{item.timeline || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Industry</p>
                                                    <p className="text-slate-800 font-medium">{item.crm_data?.industry || "N/A"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-4 justify-end border-t border-slate-50 pt-6">
                                            <button
                                                onClick={() => handleAction(item.id, 'reject')}
                                                className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 flex items-center gap-2 text-sm font-bold transition-all"
                                            >
                                                <X size={18} /> REJECT
                                            </button>
                                            <button
                                                onClick={() => handleAction(item.id, 'approve')}
                                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 flex items-center gap-2 text-sm font-bold shadow-lg shadow-slate-900/20 transition-all hover:translate-y-[-1px]"
                                            >
                                                <Check size={18} /> APPROVE
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
