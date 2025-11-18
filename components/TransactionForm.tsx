import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';

interface TransactionFormProps {
  onClose: () => void;
  onAddOrUpdateTransaction: (transaction: Omit<Transaction, 'id'>, id?: string) => void;
  onAddSavingsTransaction: (transaction: Omit<Transaction, 'id'>, id?:string) => void;
  onAddWithdrawalTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  existingTransaction?: Transaction | null;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onClose, onAddOrUpdateTransaction, onAddSavingsTransaction, onAddWithdrawalTransaction, existingTransaction }) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const isSavingsRelated = category === 'Savings Contribution' || category === 'Savings Withdrawal' || !!existingTransaction?.goal_id;
  
  useEffect(() => {
    if (existingTransaction) {
      setType(existingTransaction.type);
      setCategory(existingTransaction.category);
      setAmount(String(existingTransaction.amount));
      setDate(new Date(existingTransaction.date).toISOString().split('T')[0]);
      setDescription(existingTransaction.description);
    }
  }, [existingTransaction]);

  useEffect(() => {
    // For new transactions, clear description if user selects a savings category
    if (isSavingsRelated && !existingTransaction) {
        setDescription('');
    }
  }, [isSavingsRelated, existingTransaction]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(newType === TransactionType.EXPENSE ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || !date) return;
    
    let finalDateIsoString: string;

    // When editing, if the date part hasn't changed, we preserve the original full timestamp.
    // Otherwise (for new transactions or changed dates), we combine the selected date with the current time.
    if (existingTransaction && date === new Date(existingTransaction.date).toISOString().split('T')[0]) {
        finalDateIsoString = existingTransaction.date;
    } else {
        const newDate = new Date(date + 'T00:00:00'); // Start with selected date at midnight local time
        const now = new Date();
        newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        finalDateIsoString = newDate.toISOString();
    }

    const transactionData: Omit<Transaction, 'id'> = {
      type,
      category,
      amount: parseFloat(amount),
      date: finalDateIsoString,
      description,
      // Retain existing savings meta if editing
      goal_id: existingTransaction?.goal_id,
      savings_meta: existingTransaction?.savings_meta,
      is_valid: existingTransaction?.is_valid,
    };

    if (category === 'Savings Contribution' && !existingTransaction) { // Can't change a non-saving into a saving transaction via edit
      onAddSavingsTransaction(transactionData, existingTransaction?.id);
    } else if (type === TransactionType.INCOME && category === 'Savings Withdrawal' && !existingTransaction) {
      onAddWithdrawalTransaction(transactionData);
    }
    else {
      onAddOrUpdateTransaction(transactionData, existingTransaction?.id);
    }
    
    onClose();
  };
  
  const categories = type === TransactionType.EXPENSE ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4">
        <h2 className="text-2xl font-bold mb-6 text-white">{existingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</h2>
        <div className="flex mb-6 rounded-lg bg-gray-700 p-1">
          <button
            onClick={() => handleTypeChange(TransactionType.EXPENSE)}
            className={`w-1/2 p-2 rounded-md transition ${type === TransactionType.EXPENSE ? 'bg-red-500' : 'hover:bg-gray-600'}`}
            disabled={!!existingTransaction}
          >
            Expense
          </button>
          <button
            onClick={() => handleTypeChange(TransactionType.INCOME)}
            className={`w-1/2 p-2 rounded-md transition ${type === TransactionType.INCOME ? 'bg-green-500' : 'hover:bg-gray-600'}`}
            disabled={!!existingTransaction}
          >
            Income
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={!!existingTransaction?.goal_id} // Don't allow changing category of savings transactions
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
              disabled={isSavingsRelated}
              placeholder={isSavingsRelated ? 'Auto-generated for savings quests' : ''}
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition">Cancel</button>
            <button type="submit" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition">{existingTransaction ? 'Save Changes' : 'Add Transaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;