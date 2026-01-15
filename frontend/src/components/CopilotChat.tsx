import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CopilotChatProps {
    messages: string[];
    onSendMessage: (msg: string) => void;
    isLoading: boolean;
}

export const CopilotChat: React.FC<CopilotChatProps> = ({ messages, onSendMessage, isLoading }) => {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput("");
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText) {
            setInput(prev => prev + pastedText);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative" onCopy={(e) => e.preventDefault() === false} onPaste={(e) => e.preventDefault() === false}>
            <div className="p-5 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center select-none">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 rounded-lg text-white">
                        <Bot size={18} />
                    </div>
                    Northstar Agent
                </h2>
                <div className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                    v2.4.0
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/30 select-text">
                <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                        const isUser = msg.startsWith("User:");
                        const cleanMsg = msg.replace("User:", "").replace("Agent:", "");

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm select-text ${isUser
                                        ? 'bg-slate-900 text-white rounded-br-none shadow-slate-900/10'
                                        : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                    }`}>
                                    {!isUser && <span className="block text-xs font-bold text-blue-600 mb-1">AI AGENT</span>}
                                    {cleanMsg}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                    >
                        <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none text-sm text-slate-500 flex items-center gap-2 shadow-sm select-none">
                            <Sparkles size={14} className="text-amber-400 animate-spin-slow" />
                            Thinking...
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-5 bg-white border-t border-slate-100">
                <div className="relative group">
                    <input
                        type="text"
                        className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner text-slate-800 placeholder:text-slate-400 font-medium"
                        placeholder="Describe proposal changes..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        onPaste={handlePaste}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading}
                        className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-600/20"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
