import React, { useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { SECURITY_QUESTIONS } from '../constants';

interface ChangeSecurityQuestionModalProps {
    onClose: () => void;
    onConfirm: (question: string, answer: string) => void;
}

const ChangeSecurityQuestionModal: React.FC<ChangeSecurityQuestionModalProps> = ({ onClose, onConfirm }) => {
    const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!securityAnswer.trim()) {
            setError('Please provide an answer to the security question.');
            return;
        }
        onConfirm(securityQuestion, securityAnswer);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <ShieldQuestion className="mx-auto text-indigo-400 mb-4" size={32} />
                    <h2 className="text-xl font-bold mb-2 text-white">Change Security Question</h2>
                    <p className="text-gray-400 mb-6 text-sm">Choose a new question and provide an answer for PIN recovery.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">New PIN Recovery Question</label>
                        <select
                            value={securityQuestion}
                            onChange={(e) => setSecurityQuestion(e.target.value)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Your New Answer (case-insensitive)</label>
                        <input
                            type="password"
                            value={securityAnswer}
                            onChange={(e) => { setSecurityAnswer(e.target.value); setError(''); }}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1 pl-1">This means capitalization doesn't matter (e.g., 'apple' and 'Apple' are the same).</p>
                    </div>
                    {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangeSecurityQuestionModal;