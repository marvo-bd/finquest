// Fix: Corrected import statement for React and its hooks. 'aistudio' is a global, not an import.
import React, { useState, useCallback, useEffect } from 'react';
// Fix: Import Session as a type-only import to resolve module export error.
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import TermsScreen from './components/TermsScreen';
import PrivacyPolicyScreen from './components/PrivacyPolicyScreen';
import { User, TimePeriod, Transaction, BackupData, SavingsGoal } from './types';
import Spinner from './components/common/Spinner';
import { Currency } from './constants';

type View = 'login' | 'dashboard' | 'terms' | 'privacy';



const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>('login');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);


  // Set up Supabase auth listener
  useEffect(() => {
    let isMounted = true; // prevent state updates after unmount
    let initialized = false;
  
    const init = async () => {
      // Fix: supabase.auth.getSession is the correct async method for Supabase JS v2.
      const {
        data: { session }
      } = await supabase.auth.getSession();
  
      if (session) {
        setSession(session);
  
        setLoading(true);
        await fetchAllUserData(session.user.id);
  
        setView("dashboard");
        initialized = true;
        setLoading(false);
      } else {
        setLoading(false);
      }
  
      // Fix: supabase.auth.onAuthStateChange is the correct method for v2. The subscription is nested in the data property.
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        setSession(session);
  
        if (event === "INITIAL_SESSION") return;
  
        if (event === "SIGNED_IN" && session) {
          if (initialized) return;
  
          initialized = true;
          setLoading(true);
          await fetchAllUserData(session.user.id);
          setView("dashboard");
          setLoading(false);
          return;
        }
  
        if (event === "TOKEN_REFRESHED") return;
  
        if (event === "SIGNED_OUT") {
          setUser(null);
          setTransactions([]);
          setActivityLog([]);
          setSavingsGoals([]);
          setView("login");
          setLoading(false);
          return;
        }
      });
  
      // Cleanup subscription on unmount
      return () => {
        subscription.unsubscribe();
      };
    };
  
    init();
  
    return () => {
      isMounted = false;
    };
  }, []);
  

  const fetchAllUserData = async (userId: string) => {
    // Don't set loading to true here if it's already true, to avoid flicker.
    // The main loading state is handled by the auth listener.
    try {
      const [profileRes, transactionsRes, activityRes, goalsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('activity_log').select('log_date').eq('user_id', userId),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (activityRes.error) throw activityRes.error;
      if (goalsRes.error) throw goalsRes.error;

      if (profileRes.data) setUser(profileRes.data as User);
      if (transactionsRes.data) setTransactions(transactionsRes.data as Transaction[]);
      if (activityRes.data) setActivityLog(activityRes.data.map(log => log.log_date));

      if (goalsRes.data) {
        // Ensure "General Savings" goal exists. If not, create it.
        const hasGeneralSavings = goalsRes.data.some(g => g.is_deletable === false);
        if (!hasGeneralSavings) {
            const generalSavingsGoal: Omit<SavingsGoal, 'id' | 'created_at' | 'user_id'> = {
                name: "General Savings",
                target_amount: 0,
                current_amount: 0,
                emoji: '🏦',
                is_deletable: false, // This is the key identifier
                is_archived: false,
            };
            const { data: newGoal, error: newGoalError } = await supabase
                .from('savings_goals')
                .insert({ ...generalSavingsGoal, user_id: userId })
                .select()
                .single();
            
            if (newGoalError) throw newGoalError;
            setSavingsGoals([...goalsRes.data, newGoal] as SavingsGoal[]);
        } else {
            setSavingsGoals(goalsRes.data as SavingsGoal[]);
        }
      }

    } catch (error) {
      console.error("Error fetching user data:", error instanceof Error ? error.message : String(error));
      // Handle logout on auth error maybe? For now, just log it.
    }
  };
  
  // This effect validates transaction integrity and recalculates all savings goal balances.
  // It runs whenever transactions or the list of goals changes.
  useEffect(() => {
    if (!user) return;

    // Use a deep copy for safe mutation during validation.
    const validatedTransactions = JSON.parse(JSON.stringify(transactions));
    let transactionsHaveChanged = false;

    // This map will store the newly calculated balance for EVERY goal.
    const goalBalances = new Map<string, number>();

    // 1. Iterate over ALL goals to calculate their true current balance and validate their transaction chains.
    savingsGoals.forEach(goal => {
      let runningBalance = 0;
      // Get all transactions for the current goal from our mutable copy.
      const goalTransactions = validatedTransactions
        .filter((t: Transaction) => t.goal_id === goal.id)
        .sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // If there are transactions for this goal, validate their integrity.
      goalTransactions.forEach((t: Transaction) => {
        let currentIsValid = true;
        let currentInvalidationReason = '';

        if (t.savings_meta) {
          if (Math.abs(t.savings_meta.previousAmount - runningBalance) > 0.001) {
            currentIsValid = false;
            currentInvalidationReason = 
              `Historical mismatch. Expected ${runningBalance.toFixed(2)}, found ${t.savings_meta.previousAmount.toFixed(2)}`;
          }
        }

        // If the validity status or reason has changed, mark that a change has occurred and update the copy.
        if (t.is_valid !== currentIsValid || t.invalidation_reason !== currentInvalidationReason) {
          transactionsHaveChanged = true;
          t.is_valid = currentIsValid;
          t.invalidation_reason = currentInvalidationReason;
        }

        // Update the running balance for the next transaction in the chain.
        if (t.category === 'Savings Contribution') runningBalance += t.amount;
        if (t.category === 'Savings Withdrawal') runningBalance -= t.amount;
      });
      
      // Store the final calculated balance. If the goal had no transactions, this will be 0.
      goalBalances.set(goal.id, runningBalance);
    });

    // 2. Update local state for transactions if any were invalidated.
    if (transactionsHaveChanged) {
      setTransactions(validatedTransactions);
    }
    
    // 3. Determine which goals have a changed balance.
    const updatedGoalsFromCalculation = savingsGoals.map(goal => {
      const newBalance = goalBalances.get(goal.id) ?? 0;
      if (Math.abs(newBalance - goal.current_amount) > 0.001) {
        return { ...goal, current_amount: newBalance };
      }
      return goal;
    });

    // 4. If any goal balances have changed, update local state and persist to DB.
    // This deep comparison prevents an infinite loop.
    if (JSON.stringify(updatedGoalsFromCalculation) !== JSON.stringify(savingsGoals)) {
      setSavingsGoals(updatedGoalsFromCalculation);
      
      // We only want to send the *changed* goals to the database for efficiency.
      const goalsToUpsert = updatedGoalsFromCalculation.filter((newGoal, index) => 
        JSON.stringify(newGoal) !== JSON.stringify(savingsGoals[index])
      );
      if (goalsToUpsert.length > 0) {
        handleUpsertSavingsGoals(goalsToUpsert);
      }
    }

  }, [transactions, user, savingsGoals]);

  const handleUpdateUser = async (updatedFields: Partial<User>) => {
    if (!user) return;
    const originalUser = user;
    const newUserData = { ...user, ...updatedFields };
    setUser(newUserData); // Optimistic update
  
    // Use .update() with .eq() for a specific update operation.
    // This avoids the .upsert() behavior of attempting an insert, which
    // was causing the Row-Level Security violation because no INSERT policy exists.
    const { error } = await supabase
      .from('profiles')
      .update(updatedFields)
      .eq('id', user.id);
      
    if (error) {
      console.error("Error updating user:", error);
      setUser(originalUser); // Revert on error
    }
  };
  
  const handleUpsertTransactions = async (transactionsToUpsert: Transaction[]) => {
      if (!session?.user) return;
      const upsertData = transactionsToUpsert.map(({ ...t }) => ({ ...t, user_id: session.user.id }));
      const { error } = await supabase.from('transactions').upsert(upsertData);
      if (error) console.error("Error upserting transactions:", error);
  };
  
  const handleDeleteTransactions = async (ids: string[]) => {
      if (!session?.user) return;
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) console.error("Error deleting transactions:", error);
  }

  const handleUpdateActivityLog = async (newLog: string[]) => {
    if (!session?.user) return;
    setActivityLog(newLog);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('activity_log').upsert({ user_id: session.user.id, log_date: today });
    if (error) console.error("Error updating activity log:", error);
  };
  
  const handleUpsertSavingsGoals = async (goalsToUpdate: SavingsGoal[]) => {
      if (!session?.user) return;
      const upsertData = goalsToUpdate.map(({ ...goal }) => ({ ...goal, user_id: session.user.id }));
      const { error } = await supabase.from('savings_goals').upsert(upsertData);
      if (error) console.error("Error updating savings goals:", error);
  };

  const handleDeleteSavingsGoal = async (goalId: string) => {
    if (!session?.user) return;

    // Optimistic UI Update: remove goal and unlink transactions
    setSavingsGoals(currentGoals => currentGoals.filter(g => g.id !== goalId));
    setTransactions(currentTransactions => 
        currentTransactions.map(t => 
            t.goal_id === goalId ? { ...t, goal_id: undefined } : t
        )
    );

    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error("Error deleting savings goal:", error);
      // Revert by refetching all data on error
      await fetchAllUserData(session.user.id);
    }
  };

  const handleRestoreData = async (data: BackupData) => {
    if (!session?.user) return;
    // 1. Delete existing data
    await supabase.from('transactions').delete().eq('user_id', session.user.id);
    await supabase.from('savings_goals').delete().eq('user_id', session.user.id);
    
    // 2. Insert restored data
    await handleUpsertSavingsGoals(data.savingsGoals);
    await handleUpsertTransactions(data.transactions);

    // 3. Refresh UI from DB
    await fetchAllUserData(session.user.id);
  };

  const handleDeleteAllData = async () => {
    if (!session?.user) return;
    setLoading(true);
    await supabase.from('transactions').delete().eq('user_id', session.user.id);
    await supabase.from('savings_goals').delete().eq('user_id', session.user.id).eq('is_deletable', true);
    await supabase.from('activity_log').delete().eq('user_id', session.user.id);
    await fetchAllUserData(session.user.id);
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const userId = session.user.id;
      const providerToken = session.provider_token;
  
      // Step 1: Revoke the Google OAuth token to de-authorize the app.
      // This is a best-effort attempt and should not block account deletion.
      if (providerToken) {
        fetch(`https://oauth2.googleapis.com/revoke?token=${providerToken}`, {
          method: "POST",
          headers: { "Content-type": "application/x-www-form-urlencoded" }
        }).catch(error => {
          console.warn("Non-critical error: Failed to revoke Google OAuth token.", error);
        });
      }
  
      // Step 2: Delete user's profile picture and other files from storage.
      // This must be done before the user is deleted, as their permissions will be revoked.
      const { data: files, error: listError } = await supabase.storage
        .from("profile-pictures")
        .list(userId);
  
      if (listError) {
        console.warn("Could not list storage files for deletion, proceeding anyway.", listError);
      }
  
      if (files && files.length > 0) {
        const filePaths = files.map(file => `${userId}/${file.name}`);
        const { error: removeError } = await supabase.storage
          .from("profile-pictures")
          .remove(filePaths);
        if (removeError) {
          console.warn("Failed to delete storage files, proceeding anyway.", removeError);
        }
      }
  
      // Step 3: Call the secure database function (RPC) to delete the user.
      // This function runs with admin privileges on the server and deletes from auth.users.
      // The `ON DELETE CASCADE` on `public.profiles` will automatically delete all other user data.
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) throw rpcError;
  
      // Step 4: After successfully deleting all data, sign the user out.
      // The onAuthStateChange listener will handle resetting the UI state.
      await supabase.auth.signOut();
  
    } catch (error) {
      console.error("Failed to delete account and user data:", error);
      alert("There was an error deleting your account. Please try again or contact support.");
      setLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    setLoading(true);
    // Fix: supabase.auth.signOut is the correct method for Supabase JS v2.
    await supabase.auth.signOut();
    // The onAuthStateChange listener handles the state cleanup
  }, []);

  const renderContent = () => {
    if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner /></div>;
    
    if (session && user && view === 'dashboard') {
      return (
        <Dashboard
          user={user}
          transactions={transactions}
          activityLog={activityLog}
          savingsGoals={savingsGoals}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          onSetTransactions={setTransactions}
          onUpsertTransactions={handleUpsertTransactions}
          onDeleteTransactions={handleDeleteTransactions}
          onUpdateActivityLog={handleUpdateActivityLog}
          onSetSavingsGoals={setSavingsGoals}
          onUpsertSavingsGoals={handleUpsertSavingsGoals}
          onDeleteSavingsGoal={handleDeleteSavingsGoal}
          onRestoreData={handleRestoreData}
          onDeleteAllData={handleDeleteAllData}
          onDeleteAccount={handleDeleteAccount}
        />
      );
    }

    if (view === 'terms') return <TermsScreen onBack={() => setView('login')} />;
    if (view === 'privacy') return <PrivacyPolicyScreen onBack={() => setView('login')} />;

    return <LoginScreen onNavigateToTerms={() => setView('terms')} onNavigateToPrivacy={() => setView('privacy')} />;
  };

  return <div className="App">{renderContent()}</div>;
};

export default App;