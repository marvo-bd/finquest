import React, { useState } from 'react';
import { SavingsGoal, Transaction, TransactionType } from '../types';
import { Plus } from 'lucide-react';

interface AssignSavingsGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    pendingTransaction: Omit<Transaction, 'id' | 'goal_id'>;
    goals: SavingsGoal[];
    onSetSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
    onUpsertSavingsGoals: (goals: SavingsGoal[]) => void;
    onSetTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    onUpsertTransactions: (transactions: Transaction[]) => void;
    currencySymbol: string;
    triggerFinCheer: () => void;
}

const EMOJI_OPTIONS = ['💰', '💻', '✈️', '🚗', '🏠', '🎓', '🎁', '🚑', '💍', '🎮', '📱'];

const AssignSavingsGoalModal: React.FC<AssignSavingsGoalModalProps> = ({
    isOpen,
    onClose,
    pendingTransaction,
    goals,
    onSetSavingsGoals,
    onUpsertSavingsGoals,
    onSetTransactions,
    onUpsertTransactions,
    currencySymbol,
    triggerFinCheer
}) => {
    const [view, setView] = useState<'select' | 'create'>('select');
    const [goalName, setGoalName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0]);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleGoalSelection = (goal: SavingsGoal) => {
        const amount = pendingTransaction.amount;
        const generalGoal = goals.find(g => g.is_deletable === false);

        // Handle over-contribution by splitting the transaction
        if (goal.is_deletable !== false && (goal.current_amount + amount) > goal.target_amount) {
            const amountToComplete = goal.target_amount - goal.current_amount;
            const spilloverAmount = amount - amountToComplete;
            
            const transactionsToAdd: Transaction[] = [];
            
            if (amountToComplete > 0.001) {
                transactionsToAdd.push({
                    ...pendingTransaction,
                    id: crypto.randomUUID(),
                    amount: amountToComplete,
                    description: `Final contribution to complete: "${goal.name}"`,
                    goal_id: goal.id,
                    is_valid: true,
                    savings_meta: {
                        previousAmount: goal.current_amount,
                        currentAmount: goal.target_amount,
                    },
                });
            }
            
            if (spilloverAmount > 0.001 && generalGoal) {
                transactionsToAdd.push({
                    ...pendingTransaction,
                    id: crypto.randomUUID(),
                    amount: spilloverAmount,
                    description: `Spillover from "${goal.name}" to General Savings`,
                    goal_id: generalGoal.id,
                    is_valid: true,
                    savings_meta: {
                        previousAmount: generalGoal.current_amount,
                        currentAmount: generalGoal.current_amount + spilloverAmount,
                    },
                });
            }
            
            onSetTransactions(current => [...current, ...transactionsToAdd].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            onUpsertTransactions(transactionsToAdd);
            
            const spilloverMessage = `Excess of ${currencySymbol}${spilloverAmount.toFixed(2)} transferred to General Savings.`;
            const generalGoalReceiptMessage = `Received ${currencySymbol}${spilloverAmount.toFixed(2)} spillover from "${goal.name}".`;

            const goalsToUpsert: SavingsGoal[] = [];
            onSetSavingsGoals(currentGoals => {
                const updatedGoals = currentGoals.map(g => {
                    if (g.id === goal.id) {
                        const updated = { ...g, unread_notification_message: spilloverMessage };
                        goalsToUpsert.push(updated);
                        return updated;
                    }
                    if (spilloverAmount > 0.001 && g.id === generalGoal?.id) {
                        const updated = { ...g, unread_notification_message: generalGoalReceiptMessage };
                        goalsToUpsert.push(updated);
                        return updated;
                    }
                    return g;
                });
                onUpsertSavingsGoals(goalsToUpsert);
                return updatedGoals;
            });
            triggerFinCheer();

        } else {
            // Original logic for normal contribution
            const newTransaction: Transaction = {
                ...pendingTransaction,
                id: crypto.randomUUID(),
                description: pendingTransaction.description 
                    ? `${pendingTransaction.description} (Goal: ${goal.name})`
                    : `Contribution to savings goal: "${goal.name}"`,
                goal_id: goal.id,
                is_valid: true,
                savings_meta: {
                    previousAmount: goal.current_amount,
                    currentAmount: goal.current_amount + amount,
                },
            };
            onSetTransactions(current => [newTransaction, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            onUpsertTransactions([newTransaction]);
            
            if (goal.is_deletable !== false && goal.current_amount < goal.target_amount && (goal.current_amount + pendingTransaction.amount) >= goal.target_amount) {
                triggerFinCheer();
            }
        }
        
        onClose();
    };

    const handleCreateGoalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedGoalName = goalName.trim();
        if (!trimmedGoalName || !targetAmount || !selectedEmoji) return;

        const isDuplicate = goals.some(
            (g) =>
              !g.is_archived &&
              g.name.trim().toLowerCase() === trimmedGoalName.toLowerCase()
          );
      
          if (isDuplicate) {
            setError('An active quest with this name already exists.');
            return;
          }
        
        const newGoal: SavingsGoal = {
            id: crypto.randomUUID(),
            name: trimmedGoalName,
            target_amount: parseFloat(targetAmount),
            current_amount: 0,
            emoji: selectedEmoji,
            created_at: new Date().toISOString(),
            is_deletable: true,
            user_id: '', // Will be set in App.tsx
            is_archived: false,
        };
        onSetSavingsGoals(currentGoals => [...currentGoals, newGoal]);
        onUpsertSavingsGoals([newGoal]);

        const amount = pendingTransaction.amount;
        const newTransaction: Transaction = {
             ...pendingTransaction,
            id: crypto.randomUUID(),
            description: `Initial contribution to new goal: "${newGoal.name}"`,
            goal_id: newGoal.id,
            is_valid: true,
            savings_meta: {
                previousAmount: 0, // It's a new goal
                currentAmount: amount,
            },
        };
        onSetTransactions(current => [newTransaction, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        onUpsertTransactions([newTransaction]);

        if (pendingTransaction.amount >= newGoal.target_amount) {
            triggerFinCheer();
        }

        onClose();
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4">
                {view === 'select' ? (
                    <>
                        <h2 className="text-2xl font-bold mb-2 text-white">Assign to Savings Quest</h2>
                        <p className="text-gray-400 mb-6">Where should this <span className="font-bold text-green-400">{currencySymbol}{pendingTransaction.amount.toFixed(2)}</span> go?</p>

                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {goals.map(goal => (
                                <button
                                    key={goal.id}
                                    onClick={() => handleGoalSelection(goal)}
                                    className="w-full flex items-center text-left p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition"
                                >
                                    <span className="text-2xl mr-4">{goal.emoji}</span>
                                    <div className="flex-grow">
                                        <p className="font-semibold text-white">{goal.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {currencySymbol}{goal.current_amount.toFixed(2)}
                                            {goal.is_deletable !== false && ` / ${currencySymbol}${goal.target_amount.toFixed(2)}`}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setView('create')}
                            className="w-full flex items-center justify-center gap-2 mt-6 p-3 bg-indigo-600/80 hover:bg-indigo-600 rounded-lg transition font-semibold"
                        >
                           <Plus size={20} /> Create New Quest
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold mb-6 text-white">Create New Quest</h2>
                        <form onSubmit={handleCreateGoalSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Quest Name</label>
                                <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g., Dream Vacation" required className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500" />
                                {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Target Amount ({currencySymbol})</label>
                                <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="2000" min="1" step="0.01" required className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Choose an Icon</label>
                                <div className="flex flex-wrap gap-2">
                                    {EMOJI_OPTIONS.map(emoji => (
                                        <button type="button" key={emoji} onClick={() => setSelectedEmoji(emoji)} className={`p-2 text-2xl rounded-lg transition ${selectedEmoji === emoji ? 'bg-indigo-500 ring-2 ring-indigo-300' : 'bg-gray-700 hover:bg-gray-600'}`}>{emoji}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-4">
                                <button type="button" onClick={() => setView('select')} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Back</button>
                                <button type="submit" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition">Create & Assign</button>
                            </div>
                        </form>
                    </>
                )}
                 <div className="flex justify-end mt-6">
                     <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default AssignSavingsGoalModal;
