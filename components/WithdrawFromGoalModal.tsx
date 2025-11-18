import React, { useMemo } from 'react';
import { SavingsGoal, Transaction } from '../types';

interface WithdrawFromGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    pendingTransaction: Omit<Transaction, 'id' | 'goal_id'>;
    goals: SavingsGoal[];
    onSetTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    onUpsertTransactions: (transactions: Transaction[]) => void;
    currencySymbol: string;
}

const WithdrawFromGoalModal: React.FC<WithdrawFromGoalModalProps> = ({
    isOpen,
    onClose,
    pendingTransaction,
    goals,
    onSetTransactions,
    onUpsertTransactions,
    currencySymbol,
}) => {
    
    const availableGoals = useMemo(() => {
        return goals.filter(g => g.current_amount >= pendingTransaction.amount && !g.is_archived);
    }, [goals, pendingTransaction.amount]);


    if (!isOpen) return null;

    const handleGoalSelection = (goal: SavingsGoal) => {
        const newTransaction: Transaction = {
            ...pendingTransaction,
            id: crypto.randomUUID(),
            description: pendingTransaction.description 
                ? `${pendingTransaction.description} (From Goal: ${goal.name})`
                : `Withdrawal from savings goal: "${goal.name}"`,
            goal_id: goal.id,
            is_valid: true,
            savings_meta: {
                previousAmount: goal.current_amount,
                currentAmount: goal.current_amount - pendingTransaction.amount,
            },
        };
        onSetTransactions(current => [newTransaction, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        onUpsertTransactions([newTransaction]);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4">
                <h2 className="text-2xl font-bold mb-2 text-white">Withdraw from Savings Quest</h2>
                <p className="text-gray-400 mb-6">Which quest are you withdrawing <span className="font-bold text-red-400">{currencySymbol}{pendingTransaction.amount.toFixed(2)}</span> from?</p>

                {availableGoals.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {availableGoals.map(goal => (
                            <button
                                key={goal.id}
                                onClick={() => handleGoalSelection(goal)}
                                className="w-full flex items-center text-left p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition"
                            >
                                <span className="text-2xl mr-4">{goal.emoji}</span>
                                <div className="flex-grow">
                                    <p className="font-semibold text-white">{goal.name}</p>
                                    <p className="text-xs text-gray-400">
                                        Available: {currencySymbol}{goal.current_amount.toFixed(2)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                        <p className="font-semibold text-yellow-300">No Quests with Sufficient Funds</p>
                        <p className="text-sm text-yellow-400/80 mt-1">None of your savings quests have enough funds to cover this withdrawal of {currencySymbol}{pendingTransaction.amount.toFixed(2)}.</p>
                    </div>
                )}
                <div className="flex justify-end mt-6">
                     <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default WithdrawFromGoalModal;