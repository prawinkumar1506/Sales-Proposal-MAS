import React, { useEffect, useState } from 'react';
import { endpoints } from '../lib/api';
import { Check, X, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react';
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
            setPending(res.data);
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
        const comments = prompt(`Reason for ${action.toUpperCase()}:`, action === 'approve' ? "Approved." : "Margin too low.");
        if (comments === null) return;

        try {
            await endpoints.adminAction(id, action, comments);
            setPending(current => current.filter(p => p.id !== id)); // Optimistic UI
            fetchPending();
        } catch (e) {
            alert("Error performing action");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                <header className="mb-10 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Governance Dashboard</h1>
                        <p className="text-slate-500 mt-1">Review proposals flagged by the AI agent.</p>
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

                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8 flex gap-8">
                                            <div className="flex-1">
                                                <span className="text-xs uppercase font-bold text-slate-400 block mb-2">Trigger Reason</span>
                                                <div className="text-slate-700 font-medium">Compliance / Margin Threshold Exceeded</div>
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-xs uppercase font-bold text-slate-400 block mb-2">Agent Confidence</span>
                                                <div className="w-full bg-slate-200 rounded-full h-2 mb-1">
                                                    <div className="bg-amber-400 h-2 rounded-full w-[85%]"></div>
                                                </div>
                                                <span className="text-xs text-slate-500">85% (Requires Human in Loop)</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 justify-end border-t border-slate-50 pt-6">
                                            <button
                                                onClick={() => handleAction(item.id, 'reject')}
                                                className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-red-600 hover:border-red-100 flex items-center gap-2 text-sm font-bold transition-all"
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
