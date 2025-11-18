import React, { useState, useRef, useEffect } from 'react';
import { KeyRound } from 'lucide-react';

interface PinPromptModalProps {
    onClose: () => void;
    onConfirm: (pin: string) => boolean | void;
    onForgotPin?: () => void;
}

const PinPromptModal: React.FC<PinPromptModalProps> = ({ onClose, onConfirm, onForgotPin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus the hidden input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Handle auto-submit when PIN is 4 digits long
    useEffect(() => {
        if (pin.length === 4 && !isSubmitting) {
            setIsSubmitting(true);
            setTimeout(() => { // small delay for UI to update
                const success = onConfirm(pin);
                if (!success) {
                    setError(true);
                    // Shake and reset
                    setTimeout(() => {
                        setPin('');
                        setError(false);
                        setIsSubmitting(false);
                        inputRef.current?.focus();
                    }, 500);
                }
                // On success, the modal will be closed by the parent component,
                // so we don't need to reset isSubmitting here.
            }, 200);
        }
    }, [pin, onConfirm, isSubmitting]);

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '');
        if (value.length <= 4) {
            setPin(value);
        }
    };
    
    // Create an array representing the PIN digits for rendering
    const pinDisplay = Array.from({ length: 4 }, (_, i) => pin[i] || '');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-xs border border-gray-700 m-4" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <KeyRound className="mx-auto text-yellow-400 mb-4" size={32} />
                    <h2 className="text-xl font-bold mb-2 text-white">Enter PIN</h2>
                    <p className="text-gray-400 mb-6 text-sm">Enter your 4-digit PIN to continue.</p>
                    
                    {/* Visual PIN display */}
                    <div 
                        className={`flex justify-center gap-4 my-8 cursor-text ${error ? 'animate-shake' : ''}`}
                        onClick={() => inputRef.current?.focus()}
                    >
                        {pinDisplay.map((digit, index) => (
                            <div key={index} className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-gray-600 transition-colors duration-300"
                                style={{ borderColor: pin.length > index ? '#818cf8' : '' }} // indigo-400
                            >
                                {digit && (
                                    <div className="w-3 h-3 bg-indigo-400 rounded-full animate-pop-in"></div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Hidden input to capture keyboard events */}
                    <input
                        ref={inputRef}
                        type="tel" // Use "tel" for numeric keyboard on mobile
                        value={pin}
                        onChange={handlePinChange}
                        maxLength={4}
                        className="absolute w-0 h-0 opacity-0"
                        autoFocus
                    />
                     {error && <p className="text-red-400 text-sm mt-2">Incorrect PIN. Please try again.</p>}
                     {!error && <div className="h-[20px] mt-2"></div> /* Placeholder to prevent layout shift */}

                    <div className="flex justify-between items-center mt-6">
                        <div>
                            {onForgotPin && (
                                <button type="button" onClick={onForgotPin} className="text-sm text-indigo-400 hover:underline">
                                    Forgot PIN?
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                        </div>
                    </div>
                </div>
                <style>{`
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
                        20%, 40%, 60%, 80% { transform: translateX(8px); }
                    }
                    .animate-shake { animation: shake 0.5s ease-in-out; }
                    
                    @keyframes pop-in {
                        0% { transform: scale(0); }
                        100% { transform: scale(1); }
                    }
                    .animate-pop-in { animation: pop-in 0.2s ease-out; }

                    .animate-fade-in {
                      animation: fadeIn 0.3s ease-out;
                    }
                    @keyframes fadeIn {
                      from { opacity: 0; }
                      to { opacity: 1; }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default PinPromptModal;
