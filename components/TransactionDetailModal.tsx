import React from 'react';
import { Transaction, TransactionType } from '../types';
import { X, Edit, Trash2, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  currencySymbol: string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ transaction, onClose, onDelete, onEdit, currencySymbol }) => {
  const { type, category, amount, date, description, savings_meta, is_valid, invalidation_reason } = transaction;
  const isSavingsTransaction = !!savings_meta;
  const isValidTransaction = is_valid !== false; // Treat undefined as true

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 m-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Transaction Details</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition">
            <X className="text-gray-400" />
          </button>
        </div>

        <div className="space-y-4 text-gray-300">
          <div className="flex justify-between p-3 bg-gray-700/50 rounded-lg">
            <span className="font-semibold text-gray-400">Amount</span>
            <span className={`text-2xl font-bold ${type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                {type === TransactionType.INCOME ? '+' : '-'} {currencySymbol}{amount.toFixed(2)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-400">Category</p>
              <p className="font-semibold text-lg">{category}</p>
            </div>
             <div className="p-3 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-400">Date & Time</p>
              <p className="font-semibold text-lg">{new Date(date).toLocaleString()}</p>
            </div>
          </div>
          
          {description && (
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-400">Description</p>
              <p className="font-semibold">{description}</p>
            </div>
          )}

          {isSavingsTransaction && (
            <div className={`p-3 rounded-lg border-l-4 ${isValidTransaction ? 'bg-blue-900/30 border-blue-500' : 'bg-red-900/30 border-red-500'}`}>
              <h4 className="font-bold mb-2 text-lg">Savings Quest Log</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm text-gray-400">Previous Balance</p>
                  <p className="font-mono">{currencySymbol}{savings_meta.previousAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">{type === TransactionType.INCOME ? 'Withdrew' : 'Deposited'}</p>
                  <p className={`font-mono font-bold ${type === TransactionType.INCOME ? 'text-red-400' : 'text-green-400'}`}>{currencySymbol}{amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">New Balance</p>
                  <p className="font-mono">{currencySymbol}{savings_meta.currentAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center p-3 bg-gray-900/30 rounded-lg">
            <div className="relative group flex items-center gap-2">
                <span className={`font-semibold flex items-center gap-2 ${isValidTransaction ? 'text-green-400' : 'text-red-400'}`}>
                    {isValidTransaction ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    Status: {isValidTransaction ? 'Valid' : 'Invalid'}
                </span>
                <HelpCircle size={16} className="text-gray-500" />
                <div className="absolute bottom-full mb-2 w-72 p-3 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="font-bold text-indigo-400 mb-1">Fin's Notes:</p>
                    {isValidTransaction
                        ? "Hey there! This transaction looks perfect and fits right into your financial quest log. Keep up the great work!"
                        : `Whoops! It looks like this part of your quest log is out of sync, probably because a previous entry was removed. This transaction is now invalid. Deleting it will help fix your timeline!`
                    }
                     {invalidation_reason && <p className="text-xs text-gray-400 mt-2 font-mono">{invalidation_reason}</p>}
                </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onEdit} className="py-2 px-5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white font-semibold transition flex items-center gap-2">
            <Edit size={16} /> Edit
          </button>
          <button onClick={onDelete} className="py-2 px-5 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition flex items-center gap-2">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
