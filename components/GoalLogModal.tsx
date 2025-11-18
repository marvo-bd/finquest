import React, { useMemo } from 'react';
import { SavingsGoal, Transaction } from '../types';
import { X, ArrowDown, ArrowUp } from 'lucide-react';

interface GoalLogModalProps {
  goal: SavingsGoal;
  transactions: Transaction[];
  onClose: () => void;
  currencySymbol: string;
}

const GoalLogModal: React.FC<GoalLogModalProps> = ({ goal, transactions, onClose, currencySymbol }) => {
  const goalTransactions = useMemo(() => {
    return transactions
      .filter(t => t.goal_id === goal.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, goal.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <span className="text-3xl mr-3">{goal.emoji}</span>
            Log for "{goal.name}"
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition">
            <X className="text-gray-400" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto max-h-[60vh] pr-2">
          {goalTransactions.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No transactions found for this quest.</p>
          ) : (
            <ul className="space-y-3">
              {goalTransactions.map(t => (
                <li key={t.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${t.category === 'Savings Withdrawal' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {t.category === 'Savings Withdrawal' ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{t.description}</p>
                      <p className="text-xs text-gray-400">{new Date(t.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={`font-bold font-mono text-lg ${t.category === 'Savings Withdrawal' ? 'text-red-400' : 'text-green-400'}`}>
                    {t.category === 'Savings Withdrawal' ? '-' : '+'}
                    {currencySymbol}{t.amount.toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalLogModal;