import React from 'react';
import { FileText, Edit, CheckCircle, Download, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProposalViewerProps {
    draft: string;
    status: string;
}

export const ProposalViewer: React.FC<ProposalViewerProps> = ({ draft, status }) => {
    return (
        <div className="flex flex-col h-full bg-slate-50/50 backdrop-blur-sm">
            <div className="p-5 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
                <h2 className="font-bold flex items-center gap-3 text-slate-800 text-lg">
                    <FileText size={20} className="text-blue-600" />
                    Proposal Draft
                </h2>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold tracking-wide uppercase ${status === 'finalized' ? 'bg-green-50 text-green-600 border-green-200' :
                            status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                        {status}
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Download PDF">
                        <Download size={18} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Share">
                        <Share2 size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`bg-white shadow-xl shadow-slate-200/40 rounded-xl min-h-[800px] max-w-4xl mx-auto border border-slate-200/60 relative overflow-hidden transition-all ${draft ? "" : "flex items-center justify-center"
                        }`}
                >
                    {draft ? (
                        <>
                            {/* Paper texture overlay (simulated with noise or gradient) */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 pointer-events-none opacity-50"></div>

                            <div className="p-12 lg:p-16 relative z-0">
                                <pre className="whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-base lg:text-lg">
                                    {draft}
                                </pre>
                            </div>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Edit size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-slate-900 font-semibold mb-1">Canvas Empty</h3>
                            <p className="text-slate-400 text-sm">Start a conversation to generate a draft.</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};
