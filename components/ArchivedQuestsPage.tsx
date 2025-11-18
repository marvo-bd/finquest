

import React, { useState, useMemo } from 'react';
import { User, SavingsGoal } from '../types';
import { ArchiveRestore, Trash2, ShieldQuestion, KeyRound } from 'lucide-react';
import { CURRENCY_SYMBOLS } from '../constants';
import ConfirmationModal from './common/ConfirmationModal';
import PinPromptModal from './PinPromptModal';
import SetupPinModal from './SetupPinModal';
import ResetPinModal from './ResetPinModal';

interface ArchivedQuestsPageProps {
  user: User;
  goals: SavingsGoal[];
  onSetSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
  onUpsertSavingsGoals: (goals: SavingsGoal[]) => void;
  onUpdateUser: (user: Partial<User>) => void;
  onBack: () => void;
  onDeleteSavingsGoal: (goalId: string) => void;
}

const ArchivedQuestsPage: React.FC<ArchivedQuestsPageProps> = ({ user, goals, onSetSavingsGoals, onUpsertSavingsGoals, onUpdateUser, onBack, onDeleteSavingsGoal }) => {
    const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);
    const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
    const [isSetupPinModalOpen, setIsSetupPinModalOpen] = useState(false);
    const [isResetPinModalOpen, setIsResetPinModalOpen] = useState(false);
    const [actionToConfirm, setActionToConfirm] = useState<(() => void) | null>(null);

    const currencySymbol = CURRENCY_SYMBOLS[user.settings?.currency || 'USD'];
    const archivedGoals = useMemo(() => goals.filter(g => g.is_archived).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [goals]);

    const handleUnarchive = (goalToUnarchive: SavingsGoal) => {
        const updatedGoal = { ...goalToUnarchive, is_archived: false };
        // Optimistic UI update
        onSetSavingsGoals(currentGoals => currentGoals.map(g => g.id === goalToUnarchive.id ? updatedGoal : g));
        // Database update
        onUpsertSavingsGoals([updatedGoal]);
    };

    const handleProtectedAction = (action: () => void) => {
        if (!user.settings?.actionPin) {
            setActionToConfirm(() => action);
            setIsSetupPinModalOpen(true);
            return;
        }
        setActionToConfirm(() => action);
        setIsPinPromptOpen(true);
    };

    const handleDeleteRequest = (goal: SavingsGoal) => {
        handleProtectedAction(() => {
            setGoalToDelete(goal);
        });
    };
    
    const executeDelete = () => {
        if (!goalToDelete) return;
        onDeleteSavingsGoal(goalToDelete.id);
        setGoalToDelete(null);
    };

    const handlePinSetupComplete = (newPin: string) => {
        onUpdateUser({ settings: { ...user.settings, actionPin: newPin } });
        setIsSetupPinModalOpen(false);

        if (actionToConfirm) {
            setIsPinPromptOpen(true);
        }
    };


    return (
        <div>
            <div className="bg-gray-800/50 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-700 mb-8">
                <p className="text-center text-gray-400 mb-6">This is your vault of completed quests. From here, you can restore a quest to your dashboard to continue it, or permanently delete it.</p>
                {archivedGoals.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Your vault is empty. Complete a Savings Quest to archive it here!</p>
                ) : (
                    <div className="space-y-4">
                        {archivedGoals.map(goal => (
                            <div key={goal.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                    <span className="text-3xl">{goal.emoji}</span>
                                    <div>
                                        <p className="font-bold text-lg text-gray-300">{goal.name}</p>
                                        <p className="text-xs text-gray-400">
                                            Completed with {currencySymbol}{goal.current_amount.toFixed(2)} / {currencySymbol}{goal.target_amount.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleUnarchive(goal)} className="flex items-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition text-sm">
                                        <ArchiveRestore size={16} /> Unarchive
                                    </button>
                                    <button onClick={() => handleDeleteRequest(goal)} className="flex items-center gap-2 py-2 px-4 bg-red-800 hover:bg-red-900 rounded-lg text-white font-semibold transition text-sm">
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <ConfirmationModal
                isOpen={!!goalToDelete}
                onClose={() => setGoalToDelete(null)}
                onConfirm={executeDelete}
                title="Permanently Delete Quest?"
                confirmText="Yes, Delete Forever"
                confirmButtonClass="bg-red-800 hover:bg-red-900"
            >
                <p>Are you sure you want to permanently delete the archived quest: <strong className="font-bold text-indigo-300">"{goalToDelete?.name}"</strong>?</p>
                <p className="mt-2 text-yellow-300">This action is irreversible and cannot be undone.</p>
            </ConfirmationModal>

            {isPinPromptOpen && (
                <PinPromptModal
                    onClose={() => {
                        setIsPinPromptOpen(false);
                        setActionToConfirm(null);
                    }}
                    onConfirm={(pin) => {
                        if (pin === user.settings?.actionPin) {
                            actionToConfirm?.();
                            setIsPinPromptOpen(false);
                            setActionToConfirm(null);
                            return true;
                        }
                        return false;
                    }}
                    onForgotPin={user.settings?.securityQuestion ? () => {
                        setIsPinPromptOpen(false);
                        setIsResetPinModalOpen(true);
                    } : undefined}
                />
            )}

            {isSetupPinModalOpen && (
                <SetupPinModal
                    onClose={() => {
                        setIsSetupPinModalOpen(false);
                        setActionToConfirm(null);
                    }}
                    onPinSet={handlePinSetupComplete}
                />
            )}
            
            {isResetPinModalOpen && (
                <ResetPinModal
                    user={user}
                    onClose={() => setIsResetPinModalOpen(false)}
                    onPinReset={(newPin) => {
                        onUpdateUser({ settings: { ...user.settings, actionPin: newPin } });
                        setIsResetPinModalOpen(false);
                        if (actionToConfirm) {
                            setIsPinPromptOpen(true);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ArchivedQuestsPage;