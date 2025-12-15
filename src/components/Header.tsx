import React from 'react';

interface HeaderProps {
    onAuthOpen: () => void;
    userRole: 'CLIENT' | 'MASTER' | null;
}

const Header: React.FC<HeaderProps> = ({ onAuthOpen, userRole }) => {
    return (
        <header className="flex justify-between items-center py-4 px-6 bg-white shadow-md w-full">
            <h1 className="text-2xl font-bold text-indigo-700">PrenotaFacile</h1>
            <button onClick={onAuthOpen} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                {userRole ? `Accesso: ${userRole}` : 'Login Admin'}
            </button>
        </header>
    );
};

export default Header;
