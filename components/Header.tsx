import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';
import { Currency } from '../constants';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  level: number;
  xp: number;
  onUpdateSettings: (settings: { currency: Currency }) => void;
  onProfileClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, level, xp, onProfileClick }) => {

  return (
    <header className="bg-gray-800/30 p-4 shadow-lg border-b border-gray-700 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">FinQuest AI</h1>
        </div>
        
        <div id="tour-step-0" className="flex items-center gap-4">
            <div className="hidden sm:block">
              <span className="text-sm font-semibold text-yellow-400">Level {level}</span>
              <div className="w-32 bg-gray-700 rounded-full h-2.5 mt-1">
                <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${xp}%` }}></div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={onProfileClick} className="flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-gray-700/50 transition-colors">
                <img src={user.image_url} alt={user.name} className="w-10 h-10 rounded-full border-2 border-indigo-400" />
                <div className="hidden md:block text-left">
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
              </button>
              <button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-700 transition">
                <LogOut className="text-gray-400" />
              </button>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
