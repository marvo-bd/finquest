

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { User, Transaction, TransactionType, TimePeriod, ChartData, BackupData, SavingsGoal } from '../types';
import { CURRENCY_SYMBOLS, COLORS, EXPENSE_CATEGORIES } from '../constants';
import Header from './Header';
import TransactionForm from './TransactionForm';
import AIAssistant from './AIAssistant';
import ReportGenerator from './ReportGenerator';
import SettingsPage from './SettingsPage';
import HabitTracker from './HabitTracker'; 
import SavingsGoals from './SavingsGoals';
import FinAvatar from './FinAvatar';
import Spinner from './common/Spinner';
import WelcomeModal from './WelcomeModal';
import TourGuide from './TourGuide';
import AssignSavingsGoalModal from './AssignSavingsGoalModal';
import TransactionDetailModal from './TransactionDetailModal';
import PinPromptModal from './PinPromptModal';
import SetupPinModal from './SetupPinModal';
import ResetPinModal from './ResetPinModal';
import GoalLogModal from './GoalLogModal';
import ConfirmationModal from './common/ConfirmationModal';
import { PlusCircle, Download, BarChart2, PieChart as PieChartIcon, X, Trash2, Edit, CheckSquare, Square, ListChecks, Filter } from 'lucide-react';
import WithdrawFromGoalModal from './WithdrawFromGoalModal';


interface DashboardProps {
  user: User;
  transactions: Transaction[];
  activityLog: string[];
  savingsGoals: SavingsGoal[];
  onLogout: () => void;
  onUpdateUser: (user: Partial<User>) => void;
  onSetTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  onUpsertTransactions: (transactions: Transaction[]) => void;
  onDeleteTransactions: (ids: string[]) => void;
  onUpdateActivityLog: (log: string[]) => void;
  onSetSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
  onUpsertSavingsGoals: (goals: SavingsGoal[]) => void;
  onDeleteSavingsGoal: (goalId: string) => void;
  onRestoreData: (data: BackupData) => void;
  onDeleteAllData: () => void;
  onDeleteAccount: () => void;
}

const tourSteps = [
  {
    selector: '#tour-step-0',
    title: "Your Adventurer's Profile!",
    content: "It's me, Fin! And this here is your profile. Keep an eye on your level and XP bar—they grow as you log more transactions. Click your picture anytime to head back to settings.",
  },
  {
    selector: '#tour-step-1',
    title: 'Your Treasure Chest',
    content: "Think of these as your scorecards! They show the treasure you've gained (income) and spent (expense). Your balance is what's left in the chest. Let's keep it growing!",
  },
  {
    selector: '#tour-step-2',
    title: 'Mapping Your Journey',
    content: "This chart is a map of your financial adventure over time. You can switch the view from daily to yearly to see the bigger picture of where your money is flowing.",
  },
  {
    selector: '#tour-step-3',
    title: "Embark on Savings Quests!",
    content: "This is where you can set big goals for your treasure! Create quests for things you want to save up for, like a new gadget or a vacation. Track your progress and watch your savings grow!",
  },
  {
    selector: '#tour-step-4',
    title: 'Your Daily Quest Hub',
    content: "This is super important! To build a mighty streak, check in here every day. Either add a transaction or, if you had a no-spend day, just hit the 'Log Nil' button. Don't break the chain!",
  },
  {
    selector: '#tour-step-5',
    title: 'Ask Me Anything!',
    content: "That's me again! Whenever you want some advice or a summary of your spending, click 'Get Insights'. I'll analyze everything and give you a helpful tip for your quest.",
  },
  {
    selector: '#tour-step-6',
    title: 'Your Quest Logbook',
    content: "Here's where all your transactions are listed—your logbook of every financial move you make. You can click any transaction to see details, or use the 'Select' button to manage multiple entries.",
  },
  {
    selector: '#tour-step-7',
    title: 'Begin Your First Quest!',
    content: "Alright, adventurer, you're all set! Click this button to log your very first transaction. Every great journey starts with a single step. Let's go!",
  },
];


const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  transactions, 
  activityLog,
  savingsGoals,
  onLogout, 
  onUpdateUser,
  onSetTransactions,
  onUpsertTransactions,
  onDeleteTransactions,
  onUpdateActivityLog,
  onSetSavingsGoals,
  onUpsertSavingsGoals,
  onDeleteSavingsGoal,
  onRestoreData,
  onDeleteAllData,
  onDeleteAccount,
}) => {
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isAssignGoalModalOpen, setAssignGoalModalOpen] = useState(false);
  const [pendingTransactionForGoal, setPendingTransactionForGoal] = useState<Omit<Transaction, 'id' | 'goal_id'> | null>(null);
  
  const [isWithdrawFromGoalModalOpen, setWithdrawFromGoalModalOpen] = useState(false);
  const [pendingTransactionForWithdrawal, setPendingTransactionForWithdrawal] = useState<Omit<Transaction, 'id' | 'goal_id'> | null>(null);


  const [timePeriod, setTimePeriod] = useState<TimePeriod>(user.settings?.defaultDashboardView || TimePeriod.MONTHLY);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [showWelcomeModal, setShowWelcomeModal] = useState(user.is_new_user || false);
  
  const [showFin, setShowFin] = useState(false);
  const [finAnimation, setFinAnimation] = useState<'idle' | 'cheer'>('idle');

  const [tourStep, setTourStep] = useState<number | null>(null);
  const previousViewRef = useRef(currentView);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailModalTransaction, setDetailModalTransaction] = useState<Transaction | null>(null);
  const [pinPrompt, setPinPrompt] = useState<{ isOpen: boolean, onConfirm: (pin: string) => boolean | void } | null>(null);

  const [isSetupPinModalOpen, setIsSetupPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isResetPinModalOpen, setIsResetPinModalOpen] = useState(false);
  const [logModalGoal, setLogModalGoal] = useState<SavingsGoal | null>(null);
  
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);
  const [isDeleteGoalConfirmOpen, setIsDeleteGoalConfirmOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);


  const currencySymbol = useMemo(() => CURRENCY_SYMBOLS[user.settings?.currency || 'USD'], [user.settings]);

  useEffect(() => {
    const wasOnSettings = previousViewRef.current === 'settings';
    if (wasOnSettings && currentView === 'dashboard' && !user.has_completed_tour) {
      setTimeout(() => setTourStep(0), 300); 
    }
    previousViewRef.current = currentView;
  }, [currentView, user.has_completed_tour]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
            setIsFilterMenuOpen(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  useEffect(() => {
    if (user.settings?.defaultDashboardView) {
      setTimePeriod(user.settings.defaultDashboardView);
    }
  }, [user.settings?.defaultDashboardView]);
  
  const triggerFinCheer = useCallback(() => {
    setFinAnimation('cheer');
    setShowFin(true);
    setTimeout(() => {
      setShowFin(false);
      setFinAnimation('idle');
    }, 4000);
  }, []);

  const logTodaysActivity = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (!activityLog.includes(today)) {
        onUpdateActivityLog([...activityLog, today]);
        triggerFinCheer();
    }
  }, [activityLog, triggerFinCheer, onUpdateActivityLog]);

  const handleAddOrUpdateTransaction = (transactionData: Omit<Transaction, 'id'>, id?: string) => {
    if (id) { // Editing
      const originalTransaction = transactions.find(t => t.id === id);
      if (!originalTransaction) return;

      const updatedTransaction = { ...originalTransaction, ...transactionData };
      
      // Optimistic update
      onSetTransactions(current => current.map(t => (t.id === id ? updatedTransaction : t)));
      // DB update
      onUpsertTransactions([updatedTransaction]);
    } else { // Adding a new transaction
      const newTransaction = { ...transactionData, id: crypto.randomUUID(), is_valid: true } as Transaction;
      // Optimistic update
      onSetTransactions(current => [newTransaction, ...current].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      // DB update
      onUpsertTransactions([newTransaction]);
      // The act of adding a transaction, regardless of its date, counts as today's activity.
      logTodaysActivity();
    }
    setEditingTransaction(null);
  };
  
  const handleAddSavingsTransaction = (transaction: Omit<Transaction, 'id' | 'goal_id'>, id?: string) => {
    setPendingTransactionForGoal(transaction);
    setTransactionModalOpen(false);
    setAssignGoalModalOpen(true);
  };
  
  const handleAddWithdrawalTransaction = (transaction: Omit<Transaction, 'id' | 'goal_id'>) => {
    setPendingTransactionForWithdrawal(transaction);
    setTransactionModalOpen(false);
    setWithdrawFromGoalModalOpen(true);
  };

  const handleProtectedAction = (action: () => void) => {
    if (!user.settings?.actionPin) {
        setPendingAction(() => action);
        setIsSetupPinModalOpen(true);
        return;
    }
    setPinPrompt({
        isOpen: true,
        onConfirm: (pin) => {
            if (pin === user.settings?.actionPin) {
                action();
                setPinPrompt(null);
                return true;
            }
            return false;
        }
    });
  };

  const executeDeleteTransactions = (idsToDelete: string[]) => {
    // Optimistic update
    onSetTransactions(current => current.filter(t => !idsToDelete.includes(t.id)));
    // DB update
    onDeleteTransactions(idsToDelete);

    setSelectionMode(false);
    setSelectedIds(new Set());
    setDetailModalTransaction(null);
  }

  const handleDeleteTransactionsRequest = (ids: string[]) => {
    handleProtectedAction(() => executeDeleteTransactions(ids));
  };

  const handleEditTransactionRequest = (transaction: Transaction) => {
    handleProtectedAction(() => {
      setEditingTransaction(transaction);
      setDetailModalTransaction(null);
      setTransactionModalOpen(true);
    });
  };
  
  const handleGenerateReportRequest = () => {
    handleProtectedAction(() => setIsGeneratingReport(true));
  };

  const handlePinSetupComplete = (newPin: string) => {
    onUpdateUser({ settings: { ...user.settings, actionPin: newPin } });
    setIsSetupPinModalOpen(false);

    if (pendingAction) {
        setPinPrompt({
            isOpen: true,
            onConfirm: (pin) => {
                if (pin === newPin) {
                    pendingAction();
                    setPinPrompt(null);
                    setPendingAction(null);
                    return true;
                }
                return false;
            },
        });
    }
  };
  
  const executeDeleteGoal = () => {
    if (!goalToDelete) return;
    onDeleteSavingsGoal(goalToDelete.id);
    setIsDeleteGoalConfirmOpen(false);
    setGoalToDelete(null);
  };

  const handleDeleteGoalRequest = (goal: SavingsGoal) => {
      setGoalToDelete(goal);
      handleProtectedAction(() => {
          setIsDeleteGoalConfirmOpen(true);
      });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  const handleSelect = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  const onReportGenerated = () => {
    setIsGeneratingReport(false);
  };

  const handleStartPersonalization = () => {
    setShowWelcomeModal(false);
    setCurrentView('settings');
    onUpdateUser({ is_new_user: false });
  };
  
  const handleCompleteTour = () => {
    setTourStep(null);
    onUpdateUser({ has_completed_tour: true });
  }

  const isDateRangeActive = useMemo(() => !!(dateRange.start || dateRange.end), [dateRange]);

  const filteredData = useMemo(() => {
    if (isDateRangeActive) {
      return transactions.filter(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);

        const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
        const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : null;
        
        if (startDate && endDate) {
          if (startDate > endDate) {
            return tDate >= endDate && tDate <= startDate;
          }
          return tDate >= startDate && tDate <= endDate;
        }
        if (startDate) return tDate >= startDate;
        if (endDate) return tDate <= endDate;
        return true;
      });
    }

    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      switch (timePeriod) {
        case TimePeriod.DAILY:
          return tDate.toDateString() === now.toDateString();
        case TimePeriod.WEEKLY:
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0,0,0,0);
          return tDate >= startOfWeek;
        case TimePeriod.MONTHLY:
          return tDate.getFullYear() === now.getFullYear() && tDate.getMonth() === now.getMonth();
        case TimePeriod.YEARLY:
          return tDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  }, [transactions, timePeriod, dateRange, isDateRangeActive]);

  const { totalIncome, totalExpense, largestIncome, largestExpense } = useMemo(() => {
    const incomeTransactions = filteredData.filter(t => t.type === TransactionType.INCOME);
    const expenseTransactions = filteredData.filter(t => t.type === TransactionType.EXPENSE);

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    const largestIncome = incomeTransactions.reduce((max, t) => t.amount > max.amount ? t : max, { amount: 0, category: 'N/A' } as Transaction);
    const largestExpense = expenseTransactions.reduce((max, t) => t.amount > max.amount ? t : max, { amount: 0, category: 'N/A' } as Transaction);

    return { totalIncome, totalExpense, largestIncome, largestExpense };
  }, [filteredData]);
  
  const balance = totalIncome - totalExpense;

  const chartData: ChartData[] = useMemo(() => {
    const now = new Date();
    const dataMap = new Map<string, { income: number; expense: number }>();

    if (isDateRangeActive) {
        // Handle single-day selection
        if (dateRange.start && dateRange.end && dateRange.start === dateRange.end) {
            const selectedDate = new Date(dateRange.start + 'T00:00:00');
            const isToday = selectedDate.toDateString() === now.toDateString();
            const hoursToShow = isToday ? now.getHours() : 23;

            const labels: string[] = [];
            for (let i = 0; i <= hoursToShow; i++) {
                const hour = i % 12 === 0 ? 12 : i % 12;
                const ampm = i < 12 ? 'AM' : 'PM';
                labels.push(`${hour}${ampm}`);
            }

            labels.forEach(label => dataMap.set(label, { income: 0, expense: 0 }));

            filteredData.forEach(t => {
                const tDate = new Date(t.date);
                const hourRaw = tDate.getHours();
                const hour = hourRaw % 12 === 0 ? 12 : hourRaw % 12;
                const ampm = hourRaw < 12 ? 'AM' : 'PM';
                const key = `${hour}${ampm}`;

                if (dataMap.has(key)) {
                    const current = dataMap.get(key)!;
                    if (t.type === TransactionType.INCOME) current.income += t.amount;
                    else current.expense += t.amount;
                }
            });

            return Array.from(dataMap.entries()).map(([name, values]) => ({ name, ...values }));
        }

        // Handle multi-day range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
        let endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : today;

        if (dateRange.start && !dateRange.end) {
            endDate = today;
        } else if (!dateRange.start && dateRange.end) {
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 29); // 30 day range
        }
        
        if (!startDate) { // Fallback for safety
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 29);
        }

        if (startDate > endDate) {
            [startDate, endDate] = [endDate, startDate];
        }
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const key = currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            dataMap.set(key, { income: 0, expense: 0 });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        filteredData.forEach(t => {
            const key = new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
            if (dataMap.has(key)) {
                const current = dataMap.get(key)!;
                if (t.type === TransactionType.INCOME) current.income += t.amount;
                else current.expense += t.amount;
            }
        });
        return Array.from(dataMap.entries()).map(([name, values]) => ({ name, ...values }));
    }

    const labels: string[] = [];
    switch (timePeriod) {
      case TimePeriod.DAILY:
        for (let i = 0; i <= now.getHours(); i++) {
          const hour = i % 12 === 0 ? 12 : i % 12;
          const ampm = i < 12 ? 'AM' : 'PM';
          labels.push(`${hour}${ampm}`);
        }
        break;
      case TimePeriod.WEEKLY:
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 0; i <= now.getDay(); i++) {
          labels.push(days[i]);
        }
        break;
      case TimePeriod.MONTHLY:
        for (let i = 1; i <= now.getDate(); i++) {
          labels.push(String(i));
        }
        break;
      case TimePeriod.YEARLY:
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 0; i <= now.getMonth(); i++) {
          labels.push(months[i]);
        }
        break;
    }

    labels.forEach(label => dataMap.set(label, { income: 0, expense: 0 }));

    filteredData.forEach(t => {
      const tDate = new Date(t.date);
      let key = '';
      switch (timePeriod) {
        case TimePeriod.DAILY:
          const hourRaw = tDate.getHours();
          const hour = hourRaw % 12 === 0 ? 12 : hourRaw % 12;
          const ampm = hourRaw < 12 ? 'AM' : 'PM';
          key = `${hour}${ampm}`;
          break;
        case TimePeriod.WEEKLY:
          key = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][tDate.getDay()];
          break;
        case TimePeriod.MONTHLY:
          key = String(tDate.getDate());
          break;
        case TimePeriod.YEARLY:
          key = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][tDate.getMonth()];
          break;
      }
      if (dataMap.has(key)) {
        const current = dataMap.get(key)!;
        if (t.type === TransactionType.INCOME) current.income += t.amount;
        else current.expense += t.amount;
      }
    });

    return Array.from(dataMap.entries()).map(([name, values]) => ({ name, ...values }));
  }, [filteredData, timePeriod, isDateRangeActive, dateRange]);


  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    filteredData
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
      });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  const completeCategoryDataForReport = useMemo(() => {
    const categoryMap = new Map<string, number>();
    EXPENSE_CATEGORIES.forEach(cat => categoryMap.set(cat, 0));
    filteredData
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
      });
    return Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData]);

  const level = useMemo(() => Math.floor(transactions.length / 10) + 1, [transactions]);
  const xp = (transactions.length % 10) * 10;

  const reportPeriodTitle = useMemo(() => {
    if (isDateRangeActive) {
      const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00').toLocaleDateString() : 'the beginning';
      const end = dateRange.end ? new Date(dateRange.end + 'T00:00:00').toLocaleDateString() : 'today';
      if (dateRange.start && dateRange.end) return `From ${start} to ${end}`;
      if (dateRange.start) return `From ${start}`;
      if (dateRange.end) return `Until ${end}`;
      return 'All Transactions';
    }
    return `${timePeriod} Report`;
  }, [isDateRangeActive, dateRange, timePeriod]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <Header 
        user={user} 
        onLogout={onLogout} 
        level={level} 
        xp={xp} 
        onUpdateSettings={(settings) => onUpdateUser({ settings })}
        onProfileClick={() => setCurrentView('settings')}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {currentView === 'dashboard' ? (
          <>
            <div id="tour-step-1" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-green-400">Total Income</h3>
                <p className="text-3xl font-bold mt-2">{currencySymbol}{totalIncome.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-red-400">Total Expense</h3>
                <p className="text-3xl font-bold mt-2">{currencySymbol}{totalExpense.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-blue-400">Balance</h3>
                <p className={`text-3xl font-bold mt-2 ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{currencySymbol}{balance.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
              <div id="tour-step-2" className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700 lg:w-2/3">
                <div className="flex items-center mb-4 flex-wrap gap-4">
                    <h3 className="text-xl font-bold flex items-center mr-auto"><BarChart2 className="mr-2 text-indigo-400" />Expenditure Flow</h3>
                    
                    {/* Desktop filters */}
                    <div className="hidden lg:flex items-center space-x-1 bg-gray-700 p-1 rounded-lg flex-wrap">
                        {Object.values(TimePeriod).map(p => (
                            <button key={p} onClick={() => { setTimePeriod(p); setDateRange({ start: null, end: null }); }} className={`px-3 py-1 text-sm rounded-md transition ${timePeriod === p && !isDateRangeActive ? 'bg-indigo-500 text-white' : 'hover:bg-gray-600'}`}>{p}</button>
                        ))}
                        <div className="flex items-center pl-2 space-x-2">
                            <div className="flex items-center space-x-1">
                                <label htmlFor="startDate" className="text-sm text-gray-400">From:</label>
                                <input 
                                    id="startDate"
                                    type="date" 
                                    value={dateRange.start || ''}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="bg-gray-600 text-white text-sm rounded-md p-1 border-gray-500 focus:ring-indigo-500 focus:border-indigo-500 w-32"
                                />
                            </div>
                            <div className="flex items-center space-x-1">
                                <label htmlFor="endDate" className="text-sm text-gray-400">To:</label>
                                <input 
                                    id="endDate"
                                    type="date" 
                                    value={dateRange.end || ''}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="bg-gray-600 text-white text-sm rounded-md p-1 border-gray-500 focus:ring-indigo-500 focus:border-indigo-500 w-32"
                                />
                            </div>
                            {isDateRangeActive && (
                                <button onClick={() => setDateRange({ start: null, end: null })} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-500">
                                  <X size={16}/>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Mobile filter button */}
                    <div ref={filterMenuRef} className="relative lg:hidden">
                        <button
                            onClick={() => setIsFilterMenuOpen(prev => !prev)}
                            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition"
                            aria-label="Open filters"
                        >
                            <Filter size={20} />
                        </button>

                        {isFilterMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-72 max-w-[70vw] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 z-20">
                                <div className="flex flex-col space-y-3">
                                    <h4 className="font-bold text-lg mb-1">Period</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.values(TimePeriod).map(p => (
                                            <button key={p} onClick={() => { setTimePeriod(p); setDateRange({ start: null, end: null }); setIsFilterMenuOpen(false); }} className={`px-3 py-2 text-sm rounded-md transition ${timePeriod === p && !isDateRangeActive ? 'bg-indigo-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{p}</button>
                                        ))}
                                    </div>

                                    <div className="border-t border-gray-700 my-2"></div>

                                    <h4 className="font-bold text-lg mb-1">Custom Date Range</h4>
                                    <div className="flex flex-col space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="startDateMobile" className="text-sm text-gray-400">From:</label>
                                            <input 
                                                id="startDateMobile"
                                                type="date" 
                                                value={dateRange.start || ''}
                                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                                className="bg-gray-600 text-white text-sm rounded-md p-1 border-gray-500 focus:ring-indigo-500 focus:border-indigo-500 w-40"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="endDateMobile" className="text-sm text-gray-400">To:</label>
                                            <input 
                                                id="endDateMobile"
                                                type="date" 
                                                value={dateRange.end || ''}
                                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                                className="bg-gray-600 text-white text-sm rounded-md p-1 border-gray-500 focus:ring-indigo-500 focus:border-indigo-500 w-40"
                                            />
                                        </div>
                                        {isDateRangeActive && (
                                            <button onClick={() => { setDateRange({ start: null, end: null }); setIsFilterMenuOpen(false); }} className="text-sm text-red-400 hover:underline text-left mt-1">
                                            Clear Date Range
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f87171" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                      <XAxis dataKey="name" stroke="#a0aec0" />
                      <YAxis stroke="#a0aec0" tickFormatter={(value) => `${currencySymbol}${value}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }} formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`} />
                      <Area type="monotone" dataKey="income" stroke="#22c55e" fillOpacity={1} fill="url(#colorIncome)" />
                      <Area type="monotone" dataKey="expense" stroke="#f87171" fillOpacity={1} fill="url(#colorExpense)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700 lg:w-1/3">
                <h3 className="text-xl font-bold mb-4 flex items-center"><PieChartIcon className="mr-2 text-indigo-400" />Expense by Category</h3>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }} formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`}/>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div id="tour-step-3">
              <SavingsGoals
                  goals={savingsGoals}
                  onSetSavingsGoals={onSetSavingsGoals}
                  onUpsertSavingsGoals={onUpsertSavingsGoals}
                  onSetTransactions={onSetTransactions}
                  onUpsertTransactions={onUpsertTransactions}
                  currencySymbol={currencySymbol}
                  triggerFinCheer={triggerFinCheer}
                  onShowLog={setLogModalGoal}
                  onDeleteGoalRequest={handleDeleteGoalRequest}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <HabitTracker activityLog={activityLog} onNilCheckIn={logTodaysActivity} />
                <AIAssistant transactions={filteredData} currency={user.settings?.currency || 'USD'} />
            </div>

            <div id="tour-step-6" className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                <h3 className="text-xl font-bold mb-4 sm:mb-0">Transactions</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={toggleSelectionMode} 
                      className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 min-w-[180px]"
                    >
                      <ListChecks className="mr-2 h-5 w-5" />
                      {selectionMode ? 'Cancel Selection' : 'Select Transactions'}
                    </button>
                    <button 
                      onClick={handleGenerateReportRequest} 
                      disabled={isGeneratingReport}
                      className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-purple-400 disabled:cursor-wait min-w-[180px]"
                    >
                        {isGeneratingReport ? (
                            <>
                                <Spinner size="sm" color="white" />
                                <span className="ml-2">Generating...</span>
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-5 w-5" />
                                <span>Generate PDF</span>
                            </>
                        )}
                    </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-700">
                      {selectionMode && <th className="p-3 w-12"></th>}
                      <th className="p-3">Type</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 hidden sm:table-cell">Description</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3 hidden md:table-cell">Date</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map(t => (
                      <tr 
                        key={t.id} 
                        className={`border-b border-gray-700/50 transition-colors ${selectionMode ? 'hover:bg-gray-700/50' : 'cursor-pointer hover:bg-gray-700/50'} ${(t.is_valid === false) ? 'bg-red-900/40' : ''}`}
                        onClick={() => !selectionMode && setDetailModalTransaction(t)}
                      >
                        {selectionMode && (
                            <td className="p-3">
                                <button onClick={() => handleSelect(t.id)} className="w-6 h-6 flex items-center justify-center rounded border-2 border-gray-500 text-indigo-400">
                                    {selectedIds.has(t.id) && <CheckSquare size={20} />}
                                </button>
                            </td>
                        )}
                        <td className={`p-3 font-semibold ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>{t.type}</td>
                        <td className="p-3">{t.category}</td>
                        <td className="p-3 hidden sm:table-cell max-w-[200px] truncate" title={t.description}>{t.description || '-'}</td>
                        <td className="p-3">{currencySymbol}{t.amount.toFixed(2)}</td>
                        <td className="p-3 hidden md:table-cell">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          {t.is_valid === false ? (
                            <span className="inline-block px-2 py-1 text-xs font-semibold text-red-200 bg-red-800/50 rounded-full">Invalid</span>
                          ) : (
                            <span className="inline-block px-2 py-1 text-xs font-semibold text-green-200 bg-green-800/50 rounded-full">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length === 0 && <p className="text-center p-4 text-gray-500">No transactions for this period.</p>}
              </div>
            </div>

            {selectionMode && selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-700 p-3 rounded-xl shadow-lg flex items-center gap-4 z-30 border border-gray-600">
                    <p className="text-white font-semibold">{selectedIds.size} selected</p>
                    {selectedIds.size === 1 && (
                         <button onClick={() => {
                            const transactionToEdit = transactions.find(t => t.id === Array.from(selectedIds)[0]);
                            if (transactionToEdit) handleEditTransactionRequest(transactionToEdit);
                         }} className="flex items-center gap-2 py-2 px-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white font-semibold transition">
                            <Edit size={16} /> Edit
                        </button>
                    )}
                    <button onClick={() => handleDeleteTransactionsRequest(Array.from(selectedIds))} className="flex items-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition">
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            )}

            <button id="tour-step-7" onClick={() => { setEditingTransaction(null); setTransactionModalOpen(true);}} className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110">
              <PlusCircle size={28} />
            </button>
          </>
        ) : (
          <SettingsPage 
            user={user} 
            onUpdateUser={onUpdateUser} 
            onBack={() => setCurrentView('dashboard')}
            onRestoreData={onRestoreData}
            onDeleteAllData={onDeleteAllData}
            onDeleteAccount={onDeleteAccount}
            savingsGoals={savingsGoals}
            onSetSavingsGoals={onSetSavingsGoals}
            onUpsertSavingsGoals={onUpsertSavingsGoals}
            onDeleteSavingsGoal={onDeleteSavingsGoal}
          />
        )}
      </main>
      
      {showFin && (
        <div className="fixed bottom-0 right-0 w-48 h-48 z-50 pointer-events-none">
          <FinAvatar animationName={finAnimation} />
        </div>
      )}

      {showWelcomeModal && <WelcomeModal onConfirm={handleStartPersonalization} />}
      
      {tourStep !== null && (
        <TourGuide
          steps={tourSteps}
          currentStep={tourStep}
          onNext={() => setTourStep(s => s === null ? null : s + 1)}
          onPrev={() => setTourStep(s => s === null ? null : s - 1)}
          onFinish={handleCompleteTour}
        />
      )}

      {isTransactionModalOpen && 
        <TransactionForm 
            onClose={() => { setTransactionModalOpen(false); setEditingTransaction(null); }} 
            onAddOrUpdateTransaction={handleAddOrUpdateTransaction} 
            onAddSavingsTransaction={handleAddSavingsTransaction}
            onAddWithdrawalTransaction={handleAddWithdrawalTransaction}
            existingTransaction={editingTransaction}
        />}

      {detailModalTransaction && (
        <TransactionDetailModal
            transaction={detailModalTransaction}
            onClose={() => setDetailModalTransaction(null)}
            onDelete={() => handleDeleteTransactionsRequest([detailModalTransaction.id])}
            onEdit={() => handleEditTransactionRequest(detailModalTransaction)}
            currencySymbol={currencySymbol}
        />
      )}

      {pinPrompt?.isOpen && (
          <PinPromptModal
            onClose={() => setPinPrompt(null)}
            onConfirm={pinPrompt.onConfirm}
            onForgotPin={user.settings?.securityQuestion ? () => {
              setPinPrompt(null);
              setIsResetPinModalOpen(true);
            } : undefined}
          />
      )}

      {isSetupPinModalOpen && (
        <SetupPinModal
          onClose={() => {
              setIsSetupPinModalOpen(false);
              setPendingAction(null);
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
            }}
        />
      )}
      
      <ConfirmationModal
        isOpen={isDeleteGoalConfirmOpen}
        onClose={() => setIsDeleteGoalConfirmOpen(false)}
        onConfirm={executeDeleteGoal}
        title="Delete Savings Quest"
        confirmText="Yes, Delete It"
        confirmButtonClass="bg-red-800 hover:bg-red-900"
      >
        <p>Are you sure you want to permanently delete the quest: <strong className="font-bold text-indigo-300">"{goalToDelete?.name}"</strong>?</p>
        <p className="mt-2 text-yellow-300">This action is irreversible and cannot be undone.</p>
      </ConfirmationModal>

      {isAssignGoalModalOpen && pendingTransactionForGoal && (
        <AssignSavingsGoalModal
          isOpen={isAssignGoalModalOpen}
          onClose={() => setAssignGoalModalOpen(false)}
          pendingTransaction={pendingTransactionForGoal}
          goals={savingsGoals}
          onSetSavingsGoals={onSetSavingsGoals}
          onUpsertSavingsGoals={onUpsertSavingsGoals}
          onSetTransactions={onSetTransactions}
          onUpsertTransactions={onUpsertTransactions}
          currencySymbol={currencySymbol}
          triggerFinCheer={triggerFinCheer}
        />
      )}
      
      {isWithdrawFromGoalModalOpen && pendingTransactionForWithdrawal && (
        <WithdrawFromGoalModal
          isOpen={isWithdrawFromGoalModalOpen}
          onClose={() => setWithdrawFromGoalModalOpen(false)}
          pendingTransaction={pendingTransactionForWithdrawal}
          goals={savingsGoals}
          onSetTransactions={onSetTransactions}
          onUpsertTransactions={onUpsertTransactions}
          currencySymbol={currencySymbol}
        />
      )}

      {logModalGoal && (
        <GoalLogModal
            goal={logModalGoal}
            transactions={transactions}
            onClose={() => setLogModalGoal(null)}
            currencySymbol={currencySymbol}
        />
      )}

      {isGeneratingReport && (
          <ReportGenerator
            transactions={filteredData}
            user={user}
            onGenerated={onReportGenerated}
            periodTitle={reportPeriodTitle}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            balance={balance}
            categoryData={completeCategoryDataForReport}
            level={level}
            xp={xp}
            activityLog={activityLog}
            largestIncome={largestIncome}
            largestExpense={largestExpense}
          />
        )}
    </div>
  );
};

export default Dashboard;