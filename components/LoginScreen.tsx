import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface LoginScreenProps {
  onNavigateToTerms: () => void;
  onNavigateToPrivacy: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToTerms, onNavigateToPrivacy }) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    // Fix: supabase.auth.signInWithOAuth is the correct method for Supabase JS v2.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'profile email', // Explicitly request user profile data
        queryParams: {
          prompt: 'select_account', // Always show the account chooser
        },
      },
    });

    if (error) {
      setError('Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="text-center p-10 bg-gray-800/50 border border-gray-700 rounded-2xl shadow-2xl max-w-sm w-full backdrop-blur-sm">
        <h1 className="text-5xl font-bold text-white mb-2">FinQuest AI</h1>
        <p className="text-gray-300 mb-8">Your Gamified Financial Adventure</p>
        
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mx-auto flex items-center justify-center animate-pulse">
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        
        <div className="mb-6 text-left">
            <label htmlFor="terms-agree" className="flex items-start gap-3 cursor-pointer">
            <input
                id="terms-agree"
                type="checkbox"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-800"
            />
            <span className="text-sm text-gray-400">
                I have read and agree to the{' '}
                <button type="button" onClick={onNavigateToTerms} className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">
                Terms & Conditions
                </button>
                {' '}and{' '}
                <button type="button" onClick={onNavigateToPrivacy} className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">
                Privacy Policy
                </button>.
            </span>
            </label>
        </div>

        <button
          onClick={handleLogin}
          disabled={!agreed || loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-gray-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              Sign in with Google
            </>
          )}
        </button>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
};

export default LoginScreen;