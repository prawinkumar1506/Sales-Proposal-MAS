import React from 'react';
import { Database, ShieldCheck, History, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

interface ContextPanelProps {
    crmData: any;
    pricing: any;
    compliance: any;
    auditLog: string[];
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ crmData, pricing, compliance, auditLog }) => {
    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="p-5 border-b border-slate-100 font-bold text-slate-800 flex items-center gap-2">
                <Activity size={18} className="text-blue-600" />
                Live Context
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
                {/* CRM Section */}
                <section>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        CRM Data
                    </h3>
                    {crmData ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-50 p-4 rounded-xl text-xs space-y-2 border border-slate-100 shadow-sm"
                        >
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200 border-dashed">
                                <span className="text-slate-500 font-medium">Client</span>
                                <span className="font-bold text-slate-800 text-right">{crmData.name}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">Industry</span>
                                <span className="text-slate-700">{crmData.industry}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">Trust Score</span>
                                <span className={`font-bold ${crmData.trust_score > 90 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {crmData.trust_score}/100
                                </span>
                            </div>
                        </motion.div>
                    ) : <div className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 dashed">Waiting for input...</div>}
                </section>

                {/* Pricing Section */}
                <section>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Pricing Engine
                    </h3>
                    {pricing ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-50/50 p-4 rounded-xl text-xs space-y-2 border border-emerald-100"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Margin</span>
                                <span className="font-bold text-emerald-700 bg-white px-2 py-0.5 rounded shadow-sm border border-emerald-100">
                                    {(pricing.margin * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Base Cost</span>
                                <span className="font-mono text-slate-700">${pricing.base_cost?.toLocaleString()}</span>
                            </div>
                        </motion.div>
                    ) : <div className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 dashed">Pending calculation...</div>}
                </section>

                {/* Compliance Section */}
                <section>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Compliance
                    </h3>
                    {compliance ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-4 rounded-xl text-xs border transition-colors ${compliance.passed
                                ? 'bg-green-50 border-green-100 text-green-800'
                                : 'bg-rose-50 border-rose-100 text-rose-800'
                                }`}
                        >
                            <div className="font-bold flex items-center gap-2 mb-2">
                                {compliance.passed ? <ShieldCheck size={14} /> : <Database size={14} />}
                                {compliance.passed ? "PASSED CHECK" : "RISK DETECTED"}
                            </div>
                            {compliance.issues && compliance.issues.length > 0 && (
                                <ul className="list-disc pl-4 space-y-1 opacity-80">
                                    {compliance.issues.map((i: string, idx: number) => <li key={idx}>{i}</li>)}
                                </ul>
                            )}
                        </motion.div>
                    ) : <div className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 dashed">Pending Check...</div>}
                </section>

                {/* Audit Log */}
                <section className="pt-4 border-t border-slate-100">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <History size={12} /> Audit Trail
                    </h3>
                    <div className="space-y-3 pl-1 relative">
                        <div className="absolute left-[3px] top-2 bottom-2 w-px bg-slate-200"></div>
                        {auditLog && auditLog.slice(-5).map((log, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="text-[10px] text-slate-500 relative pl-4"
                            >
                                <div className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-slate-300 rounded-full border-2 border-white box-content shadow-sm"></div>
                                {log}
                            </motion.div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
