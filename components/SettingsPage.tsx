import React, { useState, useRef, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, TimePeriod, Transaction, BackupData, SavingsGoal } from '../types';
import { ArrowLeft, User as UserIcon, Mail, Camera, Save, DollarSign, BarChartHorizontal, CheckCircle, DownloadCloud, UploadCloud, AlertTriangle, FileSpreadsheet, Trash2, KeyRound, ShieldQuestion, Archive } from 'lucide-react';
import { Currency, CURRENCIES, SECURITY_QUESTIONS } from '../constants';
import Spinner from './common/Spinner';
import ConfirmationModal from './common/ConfirmationModal';
import DataAnimationOverlay from './common/DataAnimationOverlay';
import PinPromptModal from './PinPromptModal';
import SetupPinModal from './SetupPinModal';
import ResetPinModal from './ResetPinModal';
import ChangeSecurityQuestionModal from './ChangeSecurityQuestionModal';
import ArchivedQuestsPage from './ArchivedQuestsPage';


interface SettingsPageProps {
  user: User;
  onUpdateUser: (user: Partial<User>) => void;
  onBack: () => void;
  onRestoreData: (data: BackupData) => void;
  onDeleteAllData: () => void;
  onDeleteAccount: () => void;
  savingsGoals: SavingsGoal[];
  onSetSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
  onUpsertSavingsGoals: (goals: SavingsGoal[]) => void;
  onDeleteSavingsGoal: (goalId: string) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUpdateUser, onBack, onRestoreData, onDeleteAllData, onDeleteAccount, savingsGoals, onSetSavingsGoals, onUpsertSavingsGoals, onDeleteSavingsGoal }) => {
  const [name, setName] = useState(user.name);
  const [imageUrl, setImageUrl] = useState(user.image_url);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState(user.settings?.currency || 'USD');
  const [defaultView, setDefaultView] = useState(user.settings?.defaultDashboardView || TimePeriod.MONTHLY);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backupStatus, setBackupStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [isPreDeleteModalOpen, setIsPreDeleteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isFarewellModalOpen, setIsFarewellModalOpen] = useState(false);

  const [animationState, setAnimationState] = useState<{ isOpen: boolean; type: 'backup' | 'restore' | 'delete' | null }>({ isOpen: false, type: null });
  const [postAnimationAction, setPostAnimationAction] = useState<(() => void) | null>(null);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(user.settings?.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
  const [isSetupPinModalOpen, setIsSetupPinModalOpen] = useState(false);
  const [isResetPinModalOpen, setIsResetPinModalOpen] = useState(false);
  const [isChangeSecurityModalOpen, setIsChangeSecurityModalOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<(() => void) | null>(null);
  
  const [settingsView, setSettingsView] = useState<'main' | 'archived'>('main');

  const hasChanges = useMemo(() => {
    if (imageFile) return true;
    if (name !== user.name) return true;
    if (currency !== (user.settings?.currency || 'USD')) return true;
    if (defaultView !== (user.settings?.defaultDashboardView || TimePeriod.MONTHLY)) return true;
    return false;
  }, [name, imageFile, currency, defaultView, user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    setSaveStatus('saving');
    let finalImageUrl = user.image_url;

    if (imageFile) {
      // Step 1: List and delete all existing files in the user's storage folder to prevent orphans.
      const { data: files, error: listError } = await supabase.storage
        .from('profile-pictures')
        .list(user.id);

      if (listError) {
        // Not a critical error, the folder might not exist yet. Log and continue.
        console.warn("Could not list old profile pictures for deletion, proceeding with upload.", listError.message);
      }
      
      if (files && files.length > 0) {
        const filePaths = files.map(file => `${user.id}/${file.name}`);
        const { error: removeError } = await supabase.storage
          .from('profile-pictures')
          .remove(filePaths);
        if (removeError) {
          // Also not critical, don't block the new upload.
          console.warn("Failed to delete old profile pictures, proceeding with upload.", removeError.message);
        }
      }

      // Step 2: Upload the new image file.
      const filePath = `${user.id}/${Date.now()}_${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        showStatusMessage('error', 'Failed to upload new profile picture.');
        setSaveStatus('idle');
        return;
      }

      // Step 3: Get a long-lived signed URL for the new image.
      const { data, error: urlError } = await supabase.storage
        .from('profile-pictures')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10); // 10 years validity

      if (urlError) {
        console.error('Error creating signed URL:', urlError);
        showStatusMessage('error', 'Could not get image URL.');
        setSaveStatus('idle');
        return;
      }

      finalImageUrl = data.signedUrl;
    }

    // Step 4: Update user profile in the database.
    const updatedUserData: Partial<User> = {
      name,
      image_url: finalImageUrl,
      settings: {
        ...user.settings,
        currency,
        defaultDashboardView: defaultView,
      }
    };
    onUpdateUser(updatedUserData);
    setImageFile(null);
    
    // Step 5: Update UI to show save status.
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };
  
  const handleSetPin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (pin.length !== 4) {
        setPinError('PIN must be exactly 4 digits.');
        return;
    }
    if (pin !== confirmPin) {
        setPinError('PINs do not match.');
        return;
    }
    if (!securityAnswer.trim()) {
        setPinError('Please provide an answer to the security question.');
        return;
    }
    onUpdateUser({ settings: { ...user.settings, actionPin: pin, securityQuestion, securityAnswer } });
    setPin('');
    setConfirmPin('');
    setSecurityAnswer('');
    showStatusMessage('success', 'Action PIN has been set successfully!');
  };
  
  const handleSetSecurityQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
     if (!securityAnswer.trim()) {
        setPinError('Please provide an answer to the security question.');
        return;
    }
    onUpdateUser({ settings: { ...user.settings, securityQuestion, securityAnswer }});
    setSecurityAnswer('');
    showStatusMessage('success', 'PIN Recovery info saved!');
  }
  
  const handleProtectedAction = (action: () => void) => {
    if (!user.settings?.actionPin) {
      setActionToConfirm(() => action);
      setIsSetupPinModalOpen(true);
      return;
    }
    setActionToConfirm(() => action);
    setIsPinPromptOpen(true);
  };
  
  const handlePinSetupComplete = (newPin: string) => {
    onUpdateUser({ settings: { ...user.settings, actionPin: newPin } });
    setIsSetupPinModalOpen(false);

    if (actionToConfirm) {
      setIsPinPromptOpen(true);
    }
  };

  const showStatusMessage = (type: 'success' | 'error', message: string) => {
    setBackupStatus({ type, message });
    setTimeout(() => setBackupStatus({ type: 'idle', message: '' }), 4000);
  };

  const executeBackup = async (isCSV = false) => {
     try {
      const { data: transactions, error: tError } = await supabase.from('transactions').select('*').eq('user_id', user.id);
      if(tError) throw tError;

      if (isCSV) {
        if (!transactions || transactions.length === 0) {
            showStatusMessage('error', 'No transaction data found to export.');
            return;
        }
        const headers = ['id', 'type', 'category', 'amount', 'date', 'description', 'goal_id'];
        const csvRows = [headers.join(',')];
        const escapeCsvCell = (cellData: any): string => {
            const cell = String(cellData ?? '');
            if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
            return cell;
        };
        for (const t of transactions) {
            const row = [t.id, t.type, t.category, t.amount, t.date, t.description, t.goal_id].map(escapeCsvCell).join(',');
            csvRows.push(row);
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `finquest-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        showStatusMessage('success', 'CSV export successful! Check your downloads.');
      } else {
        const { data: goals, error: gError } = await supabase.from('savings_goals').select('*').eq('user_id', user.id);
        if(gError) throw gError;
        
        const backupData: BackupData = {
          transactions: transactions as Transaction[],
          savingsGoals: goals as SavingsGoal[],
          exportedAt: new Date().toISOString(),
          version: '2.0.0',
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `finquest-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        showStatusMessage('success', 'Backup successful! Check your downloads.');
      }

    } catch (error) {
      console.error("Data operation failed:", error);
      showStatusMessage('error', 'Data operation failed. Please try again.');
    }
  }
  
  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingRestoreFile(file);
      setIsRestoreModalOpen(true);
      if (e.target) e.target.value = '';
    }
  };

  const confirmRestore = () => {
    setIsRestoreModalOpen(false);
    if (!pendingRestoreFile) return;
    handleProtectedAction(() => {
        setAnimationState({ isOpen: true, type: 'restore' });
    });
  };

  const executeRestore = () => {
    if (!pendingRestoreFile) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const data: BackupData = JSON.parse(result);

        if (data && (data.version?.startsWith('2.0')) && Array.isArray(data.transactions) && Array.isArray(data.savingsGoals)) {
          await onRestoreData(data);
          showStatusMessage('success', 'Restore successful! Your data has been updated.');
        } else {
          throw new Error("Invalid or outdated backup file format.");
        }
      } catch (error) {
        console.error("Restore failed:", error);
        showStatusMessage('error', 'Restore failed. The file may be invalid or corrupted.');
      } finally {
        setPendingRestoreFile(null);
      }
    };
    reader.readAsText(pendingRestoreFile);
  }
  
  const handleConfirmDelete = () => {
    setIsDeleteModalOpen(false);
    setPostAnimationAction(() => executeDelete);
    setAnimationState({ isOpen: true, type: 'delete' });
  };
  
  const triggerDeleteAccountAnimation = () => {
    setIsDeleteAccountModalOpen(false);
    setPostAnimationAction(() => executeDeleteAccount);
    setAnimationState({ isOpen: true, type: 'delete' });
  };
  
  const handleSaveAndExit = () => {
    setIsFarewellModalOpen(false);
    executeBackup(); 
    setTimeout(() => {
      setIsDeleteAccountModalOpen(true);
    }, 500);
  };

  const handleDeleteWithoutSaving = () => {
    setIsFarewellModalOpen(false);
    setIsDeleteAccountModalOpen(true);
  };
  
  const handleBackupAndDeleteData = () => {
    setIsPreDeleteModalOpen(false);
    executeBackup();
    setTimeout(() => {
        setIsDeleteModalOpen(true);
    }, 500);
  };

  const handleDeleteDataWithoutBackup = () => {
      setIsPreDeleteModalOpen(false);
      setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    await onDeleteAllData();
    showStatusMessage('success', 'All application data has been deleted.');
  }

  const executeDeleteAccount = async () => {
    await onDeleteAccount();
  };
  
  const handleRemovePinRequest = () => {
    setActionToConfirm(() => () => {
      onUpdateUser({ settings: { ...user.settings, actionPin: undefined, securityQuestion: undefined, securityAnswer: undefined } });
      showStatusMessage('success', 'PIN has been removed.');
    });
    setIsPinPromptOpen(true);
  };

  const handleAnimationComplete = () => {
    switch (animationState.type) {
      case 'restore':
        executeRestore();
        break;
      case 'delete':
        if (postAnimationAction) {
          postAnimationAction();
        }
        break;
    }
    setPostAnimationAction(null);
    setAnimationState({ isOpen: false, type: null });
  };


  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700 transition mr-4">
          <ArrowLeft className="text-gray-300" />
        </button>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">{settingsView === 'main' ? 'Settings' : 'Archived Quests'}</h2>
      </div>

      {settingsView === 'main' ? (
      <>
        {/* PROFILE AND FINANCIAL SETTINGS FORM */}
        <form onSubmit={handleSaveChanges}>
          <div className="bg-gray-800/50 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-700 mb-8">
            <h3 className="text-xl font-semibold mb-6 text-gray-200">Profile & Financial Settings</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
              <div className="relative">
                <img src={imageUrl} alt={name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-indigo-500 object-cover" />
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-indigo-600 p-2 rounded-full hover:bg-indigo-700 transition-transform hover:scale-110" aria-label="Change profile picture">
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="flex-grow w-full">
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">Adventurer's Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 pl-10 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input id="email" type="email" value={user.email} disabled className="w-full p-2 pl-10 bg-gray-900 border border-gray-700 rounded-md text-gray-400 cursor-not-allowed" />
                  </div>
                </div>
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-400 mb-1">Currency</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="w-full p-2 pl-10 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 appearance-none">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="defaultView" className="block text-sm font-medium text-gray-400 mb-1">Default Dashboard View</label>
                <div className="relative">
                  <BarChartHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <select id="defaultView" value={defaultView} onChange={(e) => setDefaultView(e.target.value as TimePeriod)} className="w-full p-2 pl-10 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500 appearance-none">
                    {Object.values(TimePeriod).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
             <div className="flex justify-end mt-6">
                <button
                  type="submit"
                  disabled={!hasChanges || saveStatus !== 'idle'}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 disabled:bg-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed min-w-[120px]"
                >
                  {saveStatus === 'saving' && <Spinner size="sm" color="white" />}
                  {saveStatus === 'saved' && <CheckCircle size={20} />}
                  {saveStatus === 'idle' && <Save size={20} />}
                  <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}</span>
                </button>
              </div>
          </div>
        </form>

        <div className="bg-gray-800/50 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-700 mb-8">
            <h3 className="text-xl font-semibold mb-2 text-gray-200">Security</h3>
            <p className="text-sm text-gray-400 mb-6">Protect sensitive actions like deleting transactions with a 4-digit PIN.</p>
            {user.settings?.actionPin ? (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-green-900/30 p-4 rounded-lg border border-green-500/50">
                        <p className="font-semibold text-green-300 flex items-center gap-2"><CheckCircle /> Action PIN is Active</p>
                        <div className="flex gap-2 mt-3 sm:mt-0">
                            <button onClick={() => handleProtectedAction(() => setIsResetPinModalOpen(true))} className="text-sm py-1 px-3 bg-yellow-600 hover:bg-yellow-700 rounded-md transition">Reset PIN</button>
                            <button onClick={handleRemovePinRequest} className="text-sm py-1 px-3 bg-red-800 hover:bg-red-900 rounded-md transition">Remove PIN</button>
                        </div>
                    </div>
                    {user.settings.securityQuestion ? (
                         <div className="mt-4 p-4 rounded-lg border bg-gray-900/30 border-gray-600/50">
                            <h4 className="font-semibold text-gray-300 mb-2">PIN Recovery is Active</h4>
                            <div className="flex flex-col sm:flex-row justify-between items-center">
                                <p className="text-sm text-gray-400 mb-2 sm:mb-0">Question: "{user.settings.securityQuestion}"</p>
                                <button 
                                    onClick={() => handleProtectedAction(() => setIsChangeSecurityModalOpen(true))}
                                    className="text-sm py-1 px-3 bg-indigo-600 hover:bg-indigo-700 rounded-md transition"
                                >
                                    Change Question & Answer
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 p-4 rounded-lg border bg-yellow-900/30 border-yellow-500/50">
                            <h4 className="font-semibold text-yellow-300 mb-2">Set Up PIN Recovery</h4>
                            <p className="text-sm text-yellow-400/80 mb-4">You have a PIN but haven't set a recovery question. Without this, you won't be able to reset your PIN if you forget it.</p>
                            <form onSubmit={handleSetSecurityQuestion} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">PIN Recovery Question</label>
                                    <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                                        {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Your Answer (case-insensitive)</label>
                                    <input type="password" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" required />
                                    <p className="text-xs text-gray-500 mt-1 pl-1">This means capitalization doesn't matter (e.g., 'apple' and 'Apple' are the same).</p>
                                </div>
                                {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
                                <div className="flex justify-end"><button type="submit" className="flex items-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition"><ShieldQuestion size={16} /> Save Recovery Info</button></div>
                            </form>
                        </div>
                    )}
                </>
            ) : (
                <form onSubmit={handleSetPin} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">New 4-Digit PIN</label>
                            <input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0,4))} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white tracking-widest text-center" maxLength={4} required />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Confirm PIN</label>
                            <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0,4))} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white tracking-widest text-center" maxLength={4} required/>
                         </div>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">PIN Recovery Question</label>
                         <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                            {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                     </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Your Answer (case-insensitive)</label>
                        <input type="password" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" required />
                        <p className="text-xs text-gray-500 mt-1 pl-1">This means capitalization doesn't matter (e.g., 'apple' and 'Apple' are the same).</p>
                     </div>
                     {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
                     <div className="flex justify-end"><button type="submit" className="flex items-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition"><KeyRound size={16} /> Set PIN</button></div>
                </form>
            )}
        </div>
        
        <div className="bg-gray-800/50 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-700 mb-8">
             <button onClick={() => setSettingsView('archived')} className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                <div className="flex items-center gap-3">
                    <Archive size={24} className="text-yellow-400" />
                    <div>
                        <p className="font-semibold">Archived Quests</p>
                        <p className="text-xs text-gray-400">View your completed savings quests.</p>
                    </div>
                </div>
                <span className="text-sm font-bold py-1 px-3 bg-gray-800 rounded-full">{savingsGoals.filter(g => g.is_archived).length}</span>
            </button>
        </div>

        <div className="bg-red-900/20 p-6 sm:p-8 rounded-2xl shadow-lg border border-red-500/30">
            <h3 className="text-xl font-semibold mb-2 text-red-300 flex items-center gap-2"><AlertTriangle /> Danger Zone</h3>
            <p className="text-sm text-red-400/80 mb-6">These actions are permanent or can result in data loss. Proceed with caution!</p>
            
            <div className="mb-6">
                <h4 className="text-lg font-semibold mb-2 text-gray-200">Data Management</h4>
                <p className="text-sm text-gray-400 mb-6">Export your data for your own records, or restore from a backup. Restoring will overwrite all current data.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={() => executeBackup()} className="flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-center"><DownloadCloud size={24} className="mb-2 text-blue-400" /> <span className="font-semibold">Backup (JSON)</span> <span className="text-xs text-gray-400">Save all data</span></button>
                    <button onClick={() => executeBackup(true)} className="flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-center"><FileSpreadsheet size={24} className="mb-2 text-green-400" /> <span className="font-semibold">Export (CSV)</span> <span className="text-xs text-gray-400">Transactions only</span></button>
                    <button onClick={() => restoreFileRef.current?.click()} className="flex flex-col items-center justify-center p-4 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 rounded-lg transition text-center"><UploadCloud size={24} className="mb-2 text-yellow-400" /> <span className="font-semibold">Restore Backup</span> <span className="text-xs text-yellow-300/80">Overwrite data</span></button>
                    <input type="file" accept=".json" ref={restoreFileRef} onChange={handleRestoreFileSelect} className="hidden" />
                </div>
                <div className="mt-4 text-center h-6">
                    {backupStatus.type !== 'idle' && <p className={`text-sm ${backupStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{backupStatus.message}</p>}
                </div>
            </div>

            <div className="border-t border-red-500/20 my-6"></div>

            <div>
                <h4 className="text-lg font-semibold mb-2 text-red-300">Account & Data Deletion</h4>
                <p className="text-sm text-red-400/80 mb-6">These actions cannot be undone.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                     <button onClick={() => handleProtectedAction(() => setIsPreDeleteModalOpen(true))} className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-800/50 hover:bg-red-800 border border-red-500/50 rounded-lg transition text-red-300 font-semibold"><Trash2 size={16}/> Delete All Data</button>
                     <button onClick={() => handleProtectedAction(() => setIsFarewellModalOpen(true))} className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-800/50 hover:bg-red-800 border border-red-500/50 rounded-lg transition text-red-300 font-semibold"><UserIcon size={16}/> Delete Account</button>
                </div>
            </div>
        </div>
      </>
      ) : (
          <ArchivedQuestsPage 
            user={user} 
            goals={savingsGoals} 
            onSetSavingsGoals={onSetSavingsGoals}
            onUpsertSavingsGoals={onUpsertSavingsGoals}
            onUpdateUser={onUpdateUser} 
            onBack={() => setSettingsView('main')}
            onDeleteSavingsGoal={onDeleteSavingsGoal}
          />
      )}
      
      <DataAnimationOverlay isOpen={animationState.isOpen} animationType={animationState.type} onComplete={handleAnimationComplete} />
      
      <ConfirmationModal isOpen={isRestoreModalOpen} onClose={() => setIsRestoreModalOpen(false)} onConfirm={confirmRestore} title="Restore from Backup?">
        <p>Restoring from a backup will <strong className="text-red-400">completely overwrite</strong> all of your current transactions and savings goals.</p>
        <p className="mt-2 text-yellow-300">This action cannot be undone. Are you sure you wish to proceed?</p>
      </ConfirmationModal>
      
      {isPreDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm animate-fade-in" onClick={() => setIsPreDeleteModalOpen(false)}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                    <AlertTriangle className="text-yellow-400 mr-3" />
                    Delete All Application Data?
                </h2>
                <div className="text-gray-300 mb-6 space-y-2">
                    <p>This will <strong className="text-red-400">permanently delete</strong> all your transactions, savings quests, and activity log. Your user profile will not be affected.</p>
                    <p className="mt-4">Would you like to <strong className="text-indigo-300">download a final backup</strong> of your data before you delete it?</p>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-4">
                    <button onClick={handleBackupAndDeleteData} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold">Backup & Continue</button>
                    <button onClick={handleDeleteDataWithoutBackup} className="py-2 px-4 bg-red-800 hover:bg-red-900 rounded-lg font-semibold">Just Delete</button>
                    <button type="button" onClick={() => setIsPreDeleteModalOpen(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold">Cancel</button>
                </div>
            </div>
        </div>
      )}

      <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDelete} title="Final Confirmation: Delete Data?">
        <p>You are about to <strong className="text-red-400">permanently delete</strong> all your transactions, savings goals, and habit data.</p>
        <p className="mt-2 text-yellow-300">Your profile and settings will be kept. This action cannot be undone.</p>
      </ConfirmationModal>

      {isFarewellModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm animate-fade-in" onClick={() => setIsFarewellModalOpen(false)}>
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 m-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                    <AlertTriangle className="text-yellow-400 mr-3" />
                    Delete Your Account?
                </h2>
                <div className="text-gray-300 mb-6 space-y-2">
                    <p>This will <strong className="text-red-400">permanently delete</strong> your entire account and all associated data. This action is irreversible.</p>
                    <p className="mt-4">We're sad to see you go! Would you like to <strong className="text-indigo-300">download a final backup</strong> of your data before you leave?</p>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-4">
                    <button onClick={handleSaveAndExit} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold">Backup & Continue</button>
                    <button onClick={handleDeleteWithoutSaving} className="py-2 px-4 bg-red-800 hover:bg-red-900 rounded-lg font-semibold">Just Delete</button>
                    <button type="button" onClick={() => setIsFarewellModalOpen(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold">Cancel</button>
                </div>
            </div>
        </div>
      )}
      
       <ConfirmationModal
          isOpen={isDeleteAccountModalOpen}
          onClose={() => setIsDeleteAccountModalOpen(false)}
          onConfirm={triggerDeleteAccountAnimation}
          title="Are you absolutely sure?"
          confirmText="Yes, Delete My Account"
          confirmButtonClass="bg-red-800 hover:bg-red-900"
      >
          <p>This is your final confirmation. Pressing the delete button will start the <strong className="text-red-400">irreversible process</strong> of deleting your account and all associated data.</p>
          <p className="mt-2 text-yellow-300">There is no going back from this.</p>
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
      
      {isChangeSecurityModalOpen && (
        <ChangeSecurityQuestionModal
            onClose={() => setIsChangeSecurityModalOpen(false)}
            onConfirm={(newQuestion, newAnswer) => {
                onUpdateUser({ 
                    settings: { 
                        ...user.settings, 
                        securityQuestion: newQuestion, 
                        securityAnswer: newAnswer 
                    } 
                });
                showStatusMessage('success', 'Security question updated!');
            }}
        />
      )}
    </div>
  );
};

export default SettingsPage;