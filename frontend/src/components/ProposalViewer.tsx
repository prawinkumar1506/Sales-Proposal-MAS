import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Edit, Download, CheckCircle, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';

interface ProposalViewerProps {
    draft: string;
    status: string;
    finalizedData?: {
        proposal: string;
        client_name: string;
        deal_type: string;
        budget: number;
        timeline: string;
        pricing: any;
        compliance_status: string;
        finalized_timestamp: string;
    };
}

export const ProposalViewer: React.FC<ProposalViewerProps> = ({ draft, status, finalizedData }) => {
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => {
            if (pdfBlob && pdfBlob.startsWith('blob:')) {
                URL.revokeObjectURL(pdfBlob);
            }
        };
    }, [pdfBlob]);

    const generatePDF = useCallback(() => {
        const content = finalizedData?.proposal || draft;
        if (!content) return;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Set up fonts and colors
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const maxWidth = pageWidth - (margin * 2);
        let yPosition = margin;

        // Helper function to add a new page if needed
        const checkPageBreak = (requiredHeight: number) => {
            if (yPosition + requiredHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
                return true;
            }
            return false;
        };

        // Helper function to add text with word wrap
        const addText = (text: string, fontSize: number, isBold: boolean = false, color: string = '#1e293b', align: 'left' | 'center' | 'right' = 'left') => {
            pdf.setFontSize(fontSize);
            pdf.setTextColor(color);
            if (isBold) {
                pdf.setFont('helvetica', 'bold');
            } else {
                pdf.setFont('helvetica', 'normal');
            }

            const lines = pdf.splitTextToSize(text, maxWidth);
            checkPageBreak(lines.length * (fontSize * 0.5));
            
            lines.forEach((line: string) => {
                if (yPosition > pageHeight - margin - 20) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                let xPos = margin;
                if (align === 'center') {
                    xPos = pageWidth / 2;
                } else if (align === 'right') {
                    xPos = pageWidth - margin;
                }
                
                pdf.text(line, xPos, yPosition, { align });
                yPosition += fontSize * 0.5;
            });
        };

        // Add header with company info
        if (finalizedData) {
            pdf.setFillColor(15, 23, 42); // slate-900
            pdf.rect(0, 0, pageWidth, 30, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('NORTHSTAR PROPOSAL', pageWidth / 2, 15, { align: 'center' });
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });
            
            yPosition = 40;
        }

        // Parse and format the content
        const lines = content.split('\n');
        let isFirstLine = true;

        lines.forEach((line) => {
            const originalLine = line;
            line = line.trim();
            
            if (!line) {
                yPosition += 3;
                return;
            }

            // Handle headers
            if (line.startsWith('# ')) {
                if (!isFirstLine) {
                    checkPageBreak(20);
                    yPosition += 10;
                }
                isFirstLine = false;
                const title = line.substring(2).toUpperCase();
                addText(title, 22, true, '#0f172a', 'center');
                yPosition += 8;
                
                // Add decorative line
                pdf.setDrawColor(59, 130, 246); // blue-500
                pdf.setLineWidth(0.5);
                pdf.line(margin, yPosition, pageWidth - margin, yPosition);
                yPosition += 5;
            } else if (line.startsWith('## ')) {
                checkPageBreak(15);
                yPosition += 8;
                const heading = line.substring(3);
                addText(heading, 16, true, '#1e40af');
                yPosition += 4;
                
                // Add subtle underline
                pdf.setDrawColor(200, 200, 200);
                pdf.setLineWidth(0.3);
                pdf.line(margin, yPosition - 2, margin + 50, yPosition - 2);
                yPosition += 2;
            } else if (line.startsWith('### ')) {
                checkPageBreak(12);
                yPosition += 6;
                addText(line.substring(4), 13, true, '#334155');
                yPosition += 3;
            } else if (line.startsWith('**') && line.endsWith('**')) {
                // Bold text
                const boldText = line.replace(/\*\*/g, '');
                checkPageBreak(8);
                addText(boldText, 11, true);
                yPosition += 3;
            } else if (line.includes('**')) {
                // Mixed formatting - for simplicity, remove markdown and render as regular text
                // (jsPDF doesn't easily support inline formatting changes)
                const cleanLine = line.replace(/\*\*/g, '');
                checkPageBreak(8);
                addText(cleanLine, 11, false);
                yPosition += 3;
            } else {
                // Regular text
                checkPageBreak(8);
                addText(line, 11, false);
                yPosition += 3;
            }
        });

        // Add footer on all pages
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont('helvetica', 'normal');
            pdf.text(
                `Page ${i} of ${totalPages}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
            
            // Add footer line
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.3);
            pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        }

        return pdf;
    }, [finalizedData, draft]);

    const downloadAsPDF = () => {
        const pdf = generatePDF();
        if (!pdf) return;

        // Generate filename
        const clientName = finalizedData?.client_name || 'Proposal';
        const sanitizedName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Proposal_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;

        // Save the PDF
        pdf.save(filename);
    };

    const viewAsPDF = () => {
        const pdf = generatePDF();
        if (!pdf) return;

        try {
            // Generate PDF as blob URL for iframe display
            const pdfBlob = pdf.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            setPdfBlob(url);
            setShowPdfViewer(true);
            setPageNumber(1);
            setNumPages(0); // Reset page count
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };


    const renderDraftWithFormatting = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let key = 0;

        // Add header if finalized
        if (finalizedData) {
            elements.push(
                <div key={key++} className="bg-slate-900 text-white py-6 px-8 -mx-12 -mt-12 mb-8">
                    <h1 className="text-2xl font-bold text-center mb-2">NORTHSTAR PROPOSAL</h1>
                    <p className="text-sm text-center text-slate-300">Generated: {new Date().toLocaleDateString()}</p>
                </div>
            );
        }

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            
            if (!trimmed) {
                elements.push(<div key={key++} className="h-3"></div>);
                return;
            }

            // Handle headers
            if (trimmed.startsWith('# ')) {
                const title = trimmed.substring(2).toUpperCase();
                elements.push(
                    <div key={key++} className="text-center my-8">
                        <h1 className="text-3xl font-bold text-slate-900 mb-4">{title}</h1>
                        <div className="h-px bg-blue-500 mx-auto" style={{ width: '200px' }}></div>
                    </div>
                );
            } else if (trimmed.startsWith('## ')) {
                const heading = trimmed.substring(3);
                elements.push(
                    <div key={key++} className="my-6">
                        <h2 className="text-xl font-bold text-blue-600 mb-2">{heading}</h2>
                        <div className="h-px bg-slate-200 w-32"></div>
                    </div>
                );
            } else if (trimmed.startsWith('### ')) {
                elements.push(
                    <h3 key={key++} className="text-lg font-bold text-slate-700 mt-4 mb-2">
                        {trimmed.substring(4)}
                    </h3>
                );
            } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                const boldText = trimmed.replace(/\*\*/g, '');
                elements.push(
                    <p key={key++} className="font-bold text-slate-800 my-2">{boldText}</p>
                );
            } else {
                // Regular text with inline bold
                const parts = trimmed.split(/\*\*(.+?)\*\*/);
                elements.push(
                    <p key={key++} className="text-slate-700 leading-relaxed my-2">
                        {parts.map((part, i) => 
                            i % 2 === 0 ? part : <strong key={i} className="font-semibold">{part}</strong>
                        )}
                    </p>
                );
            }
        });

        return elements;
    };

    // Determine which content to show
    const displayContent = finalizedData?.proposal || draft;
    const isFinalized = status === 'finalized' && finalizedData;
    
    // Handle edge cases
    if (!displayContent && isFinalized) {
        return (
            <div className="flex flex-col h-full bg-slate-50/50 backdrop-blur-sm">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center p-8">
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
                            <FileText size={32} className="text-amber-400" />
                        </div>
                        <h3 className="text-slate-900 font-semibold mb-2">Proposal Data Missing</h3>
                        <p className="text-slate-400 text-sm">The finalized proposal data is not available. Please try refreshing the page.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 backdrop-blur-sm">
            <div className="p-5 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="font-bold flex items-center gap-3 text-slate-800 text-lg">
                        {isFinalized ? <CheckCircle size={20} className="text-green-600" /> : <FileText size={20} className="text-blue-600" />}
                        {isFinalized ? 'Finalized Proposal' : 'Proposal Draft'}
                    </h2>
                    {isFinalized && finalizedData && (
                        <div className="text-sm text-slate-500 mt-1">
                            {finalizedData.client_name} • {finalizedData.deal_type} • ${finalizedData.budget.toLocaleString()}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold tracking-wide uppercase ${status === 'finalized' ? 'bg-green-50 text-green-600 border-green-200' :
                            status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                        {status}
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <button 
                        onClick={viewAsPDF}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-lg" 
                        title="View as PDF"
                    >
                        <Eye size={18} />
                    </button>
                    <button 
                        onClick={downloadAsPDF}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-lg" 
                        title="Download as PDF"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-12">
                {/* Finalized Proposal Banner */}
                {isFinalized && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6 max-w-4xl mx-auto"
                    >
                        <div className="flex items-center gap-3">
                            <CheckCircle className="text-green-600" size={24} />
                            <div>
                                <h3 className="font-semibold text-green-800">Proposal Finalized</h3>
                                <p className="text-sm text-green-600">This proposal has been approved and is ready to send to the client.</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`bg-white shadow-xl shadow-slate-200/40 rounded-xl min-h-[800px] max-w-4xl mx-auto border border-slate-200/60 relative overflow-hidden transition-all ${displayContent ? "" : "flex items-center justify-center"
                        }`}
                >
                    {displayContent ? (
                        <>
                            {/* Paper texture overlay (simulated with noise or gradient) */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 pointer-events-none opacity-50"></div>

                            <div className="p-12 lg:p-16 relative z-0">
                                <div className="font-serif text-slate-800 leading-relaxed text-base lg:text-lg whitespace-pre-wrap">
                                    {renderDraftWithFormatting(displayContent)}
                                </div>
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

            {/* PDF Viewer Modal - Rendered via Portal */}
            {mounted && showPdfViewer && pdfBlob && createPortal(
                <AnimatePresence mode="wait">
                    <motion.div
                        key="pdf-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                        onClick={() => {
                            setShowPdfViewer(false);
                            if (pdfBlob && pdfBlob.startsWith('blob:')) {
                                URL.revokeObjectURL(pdfBlob);
                            }
                            setPdfBlob(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                            style={{ maxHeight: '90vh' }}
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <h3 className="font-bold text-slate-800 text-lg">PDF Viewer</h3>
                                    <div className="text-sm text-slate-600">
                                        <span className="px-3 py-1 bg-white border border-slate-300 rounded">
                                            PDF Document
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={downloadAsPDF}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                    >
                                        <Download size={16} />
                                        Download
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowPdfViewer(false);
                                            if (pdfBlob && pdfBlob.startsWith('blob:')) {
                                                URL.revokeObjectURL(pdfBlob);
                                            }
                                            setPdfBlob(null);
                                        }}
                                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                                        title="Close PDF"
                                    >
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>

                            {/* PDF Content - Using iframe for reliable PDF display */}
                            <div className="flex-1 overflow-hidden bg-slate-100 p-8 flex justify-center">
                                <div className="bg-white shadow-lg rounded-lg w-full h-full">
                                    <iframe
                                        src={pdfBlob}
                                        className="w-full h-full border-0 rounded-lg"
                                        title="PDF Viewer"
                                        style={{ minHeight: '600px' }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
