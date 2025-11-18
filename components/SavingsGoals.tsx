import React, { useState, useMemo } from 'react';
import { SavingsGoal, Transaction, TransactionType } from '../types';
import { PiggyBank, Plus, Target, Check, Trash2, Edit, ArrowDown, ArrowUp, Bell, Archive } from 'lucide-react';
import ConfirmationModal from './common/ConfirmationModal';

interface SavingsGoalsProps {
  goals: SavingsGoal[];
  onSetSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
  onUpsertSavingsGoals: (goals: SavingsGoal[]) => void;
  onSetTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  onUpsertTransactions: (transactions: Transaction[]) => void;
  currencySymbol: string;
  triggerFinCheer: () => void;
  onShowLog: (goal: SavingsGoal) => void;
  onDeleteGoalRequest: (goal: SavingsGoal) => void;
}

const EMOJI_OPTIONS = ['💰', '💻', '✈️', '🚗', '🏠', '🎓', '🎁', '🚑', '💍', '🎮', '📱'];

const SavingsGoals: React.FC<SavingsGoalsProps> = ({ goals, onSetSavingsGoals, onUpsertSavingsGoals, onSetTransactions, onUpsertTransactions, currencySymbol, triggerFinCheer, onShowLog, onDeleteGoalRequest }) => {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isFundsModalOpen, setIsFundsModalOpen] = useState<SavingsGoal | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<SavingsGoal | null>(null);
  const [goalToArchive, setGoalToArchive] = useState<SavingsGoal | null>(null);

  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0]);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editError, setEditError] = useState('');

  const [fundsAmount, setFundsAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');


  const openNewGoalModal = () => {
    setEditingGoal(null);
    setGoalName('');
    setTargetAmount('');
    setSelectedEmoji(EMOJI_OPTIONS[0]);
    setEditError('');
    setIsGoalModalOpen(true);
  };
  
  const openEditGoalModal = (goal: SavingsGoal) => {
    if (goal.is_deletable === false) return;
    setEditingGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setSelectedEmoji(goal.emoji);
    setEditError('');
    setIsGoalModalOpen(true);
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    const trimmedGoalName = goalName.trim();
    if (!trimmedGoalName || !targetAmount || !selectedEmoji) return;
    
    const isDuplicate = goals.some(
      (g) =>
        !g.is_archived &&
        g.name.trim().toLowerCase() === trimmedGoalName.toLowerCase() &&
        (!editingGoal || g.id !== editingGoal.id)
    );

    if (isDuplicate) {
      setEditError('An active quest with this name already exists.');
      return;
    }

    if (editingGoal) {
        const newTarget = parseFloat(targetAmount);
        if (newTarget < editingGoal.current_amount) {
            setEditError(`Target cannot be less than the current saved amount of ${currencySymbol}${editingGoal.current_amount.toFixed(2)}.`);
            return;
        }
        const updatedGoal = { ...editingGoal, name: trimmedGoalName, target_amount: parseFloat(targetAmount), emoji: selectedEmoji };
        onSetSavingsGoals(currentGoals => currentGoals.map(g => g.id === editingGoal.id ? updatedGoal : g));
        onUpsertSavingsGoals([updatedGoal]);
    } else {
        const newGoal: SavingsGoal = {
            id: crypto.randomUUID(),
            name: trimmedGoalName,
            target_amount: parseFloat(targetAmount),
            current_amount: 0,
            emoji: selectedEmoji,
            created_at: new Date().toISOString(),
            is_deletable: true,
            is_archived: false,
            user_id: '', // Will be set in App.tsx
        };
        onSetSavingsGoals(currentGoals => [...currentGoals, newGoal]);
        onUpsertSavingsGoals([newGoal]);
    }
    
    setIsGoalModalOpen(false);
  };

  const handleAddFunds = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundsAmount || !isFundsModalOpen) return;

    const amount = parseFloat(fundsAmount);
    const goal = isFundsModalOpen;
    const generalGoal = goals.find(g => g.is_deletable === false);
    
    // Handle over-contribution by splitting the transaction
    if (goal.is_deletable !== false && (goal.current_amount + amount) > goal.target_amount) {
        const amountToComplete = goal.target_amount - goal.current_amount;
        const spilloverAmount = amount - amountToComplete;
        
        const transactionsToAdd: Transaction[] = [];

        if (amountToComplete > 0.001) {
            transactionsToAdd.push({
                id: crypto.randomUUID(),
                type: TransactionType.EXPENSE,
                category: 'Savings Contribution',
                amount: amountToComplete,
                date: new Date().toISOString(),
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
                id: crypto.randomUUID(),
                type: TransactionType.EXPENSE,
                category: 'Savings Contribution',
                amount: spilloverAmount,
                date: new Date().toISOString(),
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
            id: crypto.randomUUID(),
            type: TransactionType.EXPENSE,
            category: 'Savings Contribution',
            amount: amount,
            date: new Date().toISOString(),
            description: `Contribution to savings goal: "${goal.name}"`,
            goal_id: goal.id,
            is_valid: true,
            savings_meta: {
              previousAmount: goal.current_amount,
              currentAmount: goal.current_amount + amount,
            },
        };
        onSetTransactions(current => [newTransaction, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        onUpsertTransactions([newTransaction]);
        
        if (goal.is_deletable !== false && goal.current_amount < goal.target_amount && (goal.current_amount + amount) >= goal.target_amount) {
          triggerFinCheer();
        }
    }
    
    setIsFundsModalOpen(null);
    setFundsAmount('');
  };


  const handleWithdrawFunds = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    if (!withdrawAmount || !isWithdrawModalOpen) return;

    const amount = parseFloat(withdrawAmount);
    const goal = isWithdrawModalOpen;

    if (amount > goal.current_amount) {
      setWithdrawError(`Cannot withdraw more than the available ${currencySymbol}${goal.current_amount.toFixed(2)}.`);
      return;
    }

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: TransactionType.INCOME,
      category: 'Savings Withdrawal',
      amount: amount,
      date: new Date().toISOString(),
      description: `Withdrawal from savings goal: "${goal.name}"`,
      goal_id: goal.id,
      is_valid: true,
      savings_meta: {
          previousAmount: goal.current_amount,
          currentAmount: goal.current_amount - amount,
      },
    };
    onSetTransactions(current => [newTransaction, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    onUpsertTransactions([newTransaction]);
    
    setIsWithdrawModalOpen(null);
    setWithdrawAmount('');
  };
  
  const handleArchiveConfirm = () => {
    if (!goalToArchive) return;
    const updatedGoal = { ...goalToArchive, is_archived: true };
    onSetSavingsGoals(currentGoals => currentGoals.map(g => g.id === goalToArchive.id ? updatedGoal : g));
    onUpsertSavingsGoals([updatedGoal]);
    setGoalToArchive(null);
  }
  
  const handleShowLog = (goal: SavingsGoal) => {
    onShowLog(goal);
    if (goal.unread_notification_message) {
        const updatedGoal = { ...goal, unread_notification_message: null };
        onSetSavingsGoals(currentGoals => currentGoals.map(g => g.id === goal.id ? updatedGoal : g));
        onUpsertSavingsGoals([updatedGoal]);
    }
  };

  const sortedGoals = useMemo(() => {
    return [...goals]
      .filter(g => !g.is_archived)
      .sort((a, b) => {
      const aComplete = a.current_amount >= a.target_amount;
      const bComplete = b.current_amount >= b.target_amount;
      if (aComplete && !bComplete) return 1;
      if (!aComplete && bComplete) return -1;
      
      if (a.is_deletable === false) return -1;
      if (b.is_deletable === false) return 1;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [goals]);

  return (
    <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Target className="mr-2 text-indigo-400" />
          Savings Quests
        </h3>
        <button
          onClick={openNewGoalModal}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
        >
          <Plus className="mr-2 h-5 w-5" /> New Quest
        </button>
      </div>

      {sortedGoals.length === 0 ? (
        <p className="text-center text-gray-400 py-4">No savings quests started. Click 'New Quest' to begin!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedGoals.map(goal => {
            const hasTarget = goal.is_deletable !== false;
            const progress = (hasTarget && goal.target_amount > 0) ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 100;
            const isCompleted = hasTarget && progress >= 100;
            return (
              <div key={goal.id} className={`p-4 rounded-lg border flex flex-col ${isCompleted ? 'bg-green-900/30 border-green-500/50' : 'bg-gray-700/50 border-gray-600'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{goal.emoji}</span>
                        <div>
                            <p className={`font-bold text-lg ${isCompleted ? 'text-green-300' : 'text-white'}`}>{goal.name}</p>
                            {hasTarget && <p className="text-xs text-gray-400">Target: {currencySymbol}{goal.target_amount.toFixed(2)}</p>}
                        </div>
                    </div>
                     <div className="flex items-center gap-1">
                        <div className="relative group">
                            <button onClick={() => handleShowLog(goal)} className="p-1 text-gray-400 hover:text-white transition">
                                <Bell size={14} />
                                {goal.unread_notification_message && (
                                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-gray-700/50"></span>
                                )}
                            </button>
                             {goal.unread_notification_message && (
                                <div className="absolute bottom-full mb-2 right-1/2 translate-x-1/2 w-60 p-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-center text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    {goal.unread_notification_message}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-600"></div>
                                </div>
                            )}
                        </div>
                        {goal.is_deletable !== false && (
                          <>
                            <button onClick={() => openEditGoalModal(goal)} className="p-1 text-gray-400 hover:text-white transition"><Edit size={14} /></button>
                            {isCompleted ? (
                               <button onClick={() => setGoalToArchive(goal)} className="p-1 text-gray-400 hover:text-yellow-400 transition" title="Archive Quest"><Archive size={14} /></button>
                            ) : (
                               <button onClick={() => onDeleteGoalRequest(goal)} className="p-1 text-gray-400 hover:text-red-400 transition" title="Delete Quest"><Trash2 size={14} /></button>
                            )}
                          </>
                        )}
                    </div>
                </div>
                
                {hasTarget && (
                  <>
                    <div className="w-full bg-gray-600 rounded-full h-2.5 my-2">
                      <div className={`h-2.5 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="text-sm flex justify-between text-gray-300 mb-4">
                      <span>{currencySymbol}{goal.current_amount.toFixed(2)}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                  </>
                )}
                 {!hasTarget && (
                    <p className="text-2xl font-bold text-white my-2">{currencySymbol}{goal.current_amount.toFixed(2)}</p>
                 )}
                
                <div className="mt-auto">
                 {isCompleted ? (
                    <div className="flex items-center justify-center text-center gap-2 bg-green-500/80 text-white font-bold py-2 px-3 rounded-lg text-sm">
                        <Check size={18}/> Quest Complete!
                    </div>
                 ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { setWithdrawError(''); setIsWithdrawModalOpen(goal); }} 
                        disabled={goal.current_amount <= 0}
                        className="w-full flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-lg transition text-sm disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
                        <ArrowDown size={16} className="mr-1"/> Withdraw
                      </button>
                      <button onClick={() => setIsFundsModalOpen(goal)} className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition text-sm">
                        <ArrowUp size={16} className="mr-1"/> Add Funds
                      </button>
                    </div>
                 )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Goal Modal */}
      {isGoalModalOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4">
                <h2 className="text-2xl font-bold mb-6 text-white">{editingGoal ? 'Edit Quest' : 'Start New Quest'}</h2>
                <form onSubmit={handleGoalSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Quest Name</label>
                        <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g., New Laptop" required className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Target Amount ({currencySymbol})</label>
                        <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="1000" min="1" step="0.01" required className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                         {editError && <p className="text-xs text-red-400 mt-1">{editError}</p>}
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
                        <button type="button" onClick={() => setIsGoalModalOpen(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition">{editingGoal ? 'Save Changes' : 'Start Quest'}</button>
                    </div>
                </form>
            </div>
         </div>
      )}
      
      {/* Add Funds Modal */}
      {isFundsModalOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 m-4">
                <h2 className="text-2xl font-bold mb-2 text-white flex items-center"><span className="text-3xl mr-3">{isFundsModalOpen.emoji}</span> Add Funds</h2>
                <p className="text-gray-400 mb-6">Contribute to "{isFundsModalOpen.name}"</p>
                <form onSubmit={handleAddFunds} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Amount ({currencySymbol})</label>
                        <input type="number" value={fundsAmount} onChange={(e) => setFundsAmount(e.target.value)} placeholder="50.00" min="0.01" step="0.01" autoFocus required className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg" />
                    </div>
                     <p className="text-xs text-gray-500 pt-1">This will be recorded as an expense under 'Savings Contribution' and deducted from your main balance.</p>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={() => setIsFundsModalOpen(null)} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition">Contribute</button>
                    </div>
                </form>
            </div>
         </div>
      )}
      
      {/* Withdraw Funds Modal */}
      {isWithdrawModalOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 m-4">
                <h2 className="text-2xl font-bold mb-2 text-white flex items-center"><span className="text-3xl mr-3">{isWithdrawModalOpen.emoji}</span> Withdraw Funds</h2>
                <p className="text-gray-400 mb-6">From "{isWithdrawModalOpen.name}"</p>
                <form onSubmit={handleWithdrawFunds} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Amount ({currencySymbol})</label>
                        <input 
                            type="number" 
                            value={withdrawAmount} 
                            onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(''); }}
                            placeholder="20.00" 
                            min="0.01" 
                            max={isWithdrawModalOpen.current_amount}
                            step="0.01" 
                            autoFocus 
                            required 
                            className={`w-full mt-1 p-2 bg-gray-700 border rounded-md text-white focus:ring-2 focus:border-indigo-500 text-lg ${withdrawError ? 'border-red-500 ring-red-500' : 'border-gray-600 focus:ring-indigo-500'}`} />
                         <p className="text-xs text-gray-500 mt-1">Available: {currencySymbol}{isWithdrawModalOpen.current_amount.toFixed(2)}</p>
                         {withdrawError && <p className="text-xs text-red-400 mt-1">{withdrawError}</p>}
                    </div>
                     <p className="text-xs text-gray-500 pt-1">This will be recorded as income under 'Savings Withdrawal' and added to your main balance.</p>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={() => setIsWithdrawModalOpen(null)} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition">Withdraw</button>
                    </div>
                </form>
            </div>
         </div>
      )}
      
      <ConfirmationModal
        isOpen={!!goalToArchive}
        onClose={() => setGoalToArchive(null)}
        onConfirm={handleArchiveConfirm}
        title="Archive Quest?"
        confirmText="Yes, Archive It"
        confirmButtonClass="bg-yellow-600 hover:bg-yellow-700"
      >
        <p>Fin says: "Great job completing this quest! Archiving it will move it from your dashboard to a special vault you can access in Settings."</p>
        <p className="mt-2">You can unarchive or permanently delete it later. Do you want to archive <strong>"{goalToArchive?.name}"</strong>?</p>
      </ConfirmationModal>
      
    </div>
  );
};

export default SavingsGoals;
