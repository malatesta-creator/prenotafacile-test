import React, { useState } from 'react';
import { BUSINESS_CONFIG } from '../constants';

interface LoginPanelProps {
  onLoginSuccess: (role: 'CLIENT' | 'MASTER') => void;
  onCancel: () => void;
}

const LoginPanel: React.FC<LoginPanelProps> = ({ onLoginSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      if (email === 'malatesta@open2.it' && password === 'masterkey') {
         onLoginSuccess('MASTER');
      } else if (email === BUSINESS_CONFIG.email && password === '12345') {
        onLoginSuccess('CLIENT');
      } else if (password === '12345') {
        onLoginSuccess('CLIENT');
      } else {
        setError('Credenziali non valide. Riprova.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gray-900 px-8 py-6"><h2 className="text-2xl font-bold text-white text-center">Area Riservata</h2><p className="text-gray-400 text-center text-sm mt-1">Accesso gestore attività</p></div>
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700"><p>{error}</p></div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Aziendale</label><input type="email" required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder={BUSINESS_CONFIG.email || "tuamail@esempio.com"} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="•••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-70 flex justify-center items-center">{isLoading ? '...' : 'Accedi'}</button>
        </form>
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex justify-center"><button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800 font-medium">Torna al sito web</button></div>
      </div>
    </div>
  );
};
export default LoginPanel;
