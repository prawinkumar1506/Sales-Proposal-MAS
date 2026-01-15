import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === 'admin' && password === 'admin') {
            localStorage.setItem('isAdmin', 'true');
            navigate('/admin/dashboard');
        } else {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100"
            >
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <ShieldCheck size={32} />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Admin Portal</h2>
                <p className="text-slate-500 text-center mb-8 text-sm">Secure access for proposal governance</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all font-medium text-slate-700"
                            placeholder="admin"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all font-medium text-slate-700"
                            placeholder="•••••"
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</div>}

                    <button
                        type="submit"
                        className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                    >
                        Authenticate
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-slate-400">
                    Demo Credentials: admin / admin
                </div>
            </motion.div>
        </div>
    );
};
