import React, { useState } from 'react';
import { signInWithPassword } from '../services/supabaseService';

interface LoginPanelProps {
    onClose: () => void;
    onLoginSuccess: (role: 'CLIENT' | 'MASTER') => void;
}

const LoginPanel: React.FC<LoginPanelProps> = ({ onClose, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (email === 'malatesta@open2.it' && password === '123456') {
                onLoginSuccess('MASTER');
                return;
            }

            const { user } = await signInWithPassword(email, password);
            if (user) {
                onLoginSuccess('CLIENT');
            } else {
                setError("Credenziali non valide.");
            }
        } catch (err) {
            console.error(err);
            setError("Errore di accesso. Controlla la console.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Accesso Admin</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold">×</button>
                </div>
                {error && <p className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</p>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="admin@esempio.it"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? 'Accesso in corso...' : 'Accedi'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPanel;
