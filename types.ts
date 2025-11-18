import { Currency } from './constants';

export interface User {
  id: string;
  name: string;
  email: string;
  image_url: string;
  is_new_user?: boolean;
  has_completed_tour?: boolean;
  settings?: {
    currency: Currency;
    defaultDashboardView?: TimePeriod;
    actionPin?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  };
}

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export interface Transaction {
  id: string;
  user_id?: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string; // ISO string
  description: string;
  goal_id?: string;
  is_valid?: boolean;
  invalidation_reason?: string;
  savings_meta?: {
    previousAmount: number;
    currentAmount: number;
  }
}

export enum TimePeriod {
  DAILY = 'Daily',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly',
}

export interface ChartData {
  name: string;
  income: number;
  expense: number;
}

export interface BackupData {
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  exportedAt: string;
  version: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  emoji: string;
  created_at: string; // ISO string
  is_deletable?: boolean;
  unread_notification_message?: string | null;
  is_archived?: boolean;
}