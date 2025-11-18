import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { Transaction, User } from '../types';
import { CURRENCY_SYMBOLS, COLORS } from '../constants';
import { geminiService } from '../services/geminiService';

// Declare the libraries on the window object for TypeScript
declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

interface ReportGeneratorProps {
  transactions: Transaction[];
  user: User;
  onGenerated: () => void;
  periodTitle: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryData: { name: string; value: number }[];
  level: number;
  xp: number;
  activityLog: string[];
  largestIncome: Transaction;
  largestExpense: Transaction;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ 
  transactions,
  user,
  onGenerated,
  periodTitle,
  totalIncome,
  totalExpense,
  balance,
  categoryData,
  level,
  xp,
  activityLog,
  largestIncome,
  largestExpense,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const generationInitiated = useRef(false);
  const currencySymbol = CURRENCY_SYMBOLS[user.settings?.currency || 'USD'];

  const pieChartData = categoryData.filter(item => item.value > 0);
  const tableCategoryData = useMemo(() => categoryData.filter(item => item.value > 0), [categoryData]);

  // Streak calculation logic, adapted from HabitTracker
  const streaks = useMemo(() => {
    if (activityLog.length === 0) return { current: 0, longest: 0 };
    const sortedTimestamps = [...new Set(activityLog)].map(d => new Date(d + 'T00:00:00').getTime()).sort((a, b) => a - b);
    let current = 0, longest = 0;
    if (sortedTimestamps.length > 0) {
      longest = 1; current = 1;
      for (let i = 1; i < sortedTimestamps.length; i++) {
        if (sortedTimestamps[i] - sortedTimestamps[i-1] === 86400000) current++;
        else current = 1;
        longest = Math.max(longest, current);
      }
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const lastCheckin = sortedTimestamps[sortedTimestamps.length - 1];
    if (today.getTime() - lastCheckin > 86400000) current = 0;
    return { current, longest };
  }, [activityLog]);

  useEffect(() => {
    if (generationInitiated.current) {
      return;
    }
    generationInitiated.current = true;

    const generatePdf = async () => {
      if (!reportRef.current) { onGenerated(); return; }
      
      try {
        const { jsPDF } = window.jspdf;
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = await window.html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`FinQuest-Report-${new Date().toISOString().split('T')[0]}.pdf`);

      } catch (error) { console.error("Failed to generate PDF:", error); } 
      finally { onGenerated(); }
    };

    const safelyGeneratePdf = () => {
      const maxRetries = 300; let retries = 0;
      const interval = setInterval(() => {
        if (window.jspdf && window.html2canvas) { clearInterval(interval); generatePdf(); } 
        else if (retries >= maxRetries) {
          clearInterval(interval);
          console.error("PDF generation libraries failed to load in time.");
          onGenerated();
        }
        retries++;
      }, 100);
    };
    
    // Fetch AI summary first, then generate PDF
    geminiService.generatePdfSummary(transactions, totalIncome, totalExpense, user.settings?.currency || 'USD')
      .then(summary => setAiSummary(summary))
      .catch(err => setAiSummary("Could not generate AI summary at this time."))
      .finally(() => {
        setIsAiLoading(false);
        // Wait for state to update then generate
        setTimeout(safelyGeneratePdf, 100);
      });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'fixed', left: '-9999px', top: '0px', zIndex: -1, color: '#000' }}>
      <div ref={reportRef} className="p-8 bg-white flex flex-col" style={{ width: '210mm', height: '297mm', fontFamily: 'sans-serif' }}>
        
        <header className="flex justify-between items-center w-full">
            <h1 className="text-3xl font-bold text-gray-800">Financial Summary</h1>
            <h2 className="text-xl font-semibold text-indigo-700">FinQuest AI</h2>
        </header>

        <div className="border-b-2 border-gray-200 mt-2 mb-6"></div>

        <section className="flex items-center gap-4 mb-6">
            <img src={user.image_url} alt="user" className="w-16 h-16 rounded-full border-2 border-indigo-200" crossOrigin="anonymous"/>
            <div className="flex flex-col justify-center">
                <p className="font-bold text-lg text-gray-700">{user.name} <span className="font-normal text-sm text-gray-500">({user.email})</span></p>
                <p className="text-sm text-gray-500"><strong>Report for period:</strong> {periodTitle}</p>
                <p className="text-sm text-gray-500"><strong>Generated on:</strong> {new Date().toLocaleDateString()}</p>
            </div>
        </section>

        <section className="grid grid-cols-3 gap-4 mb-6 text-center">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-bold text-green-800 text-sm">Total Income</h3>
                <p className="text-2xl font-bold text-green-600">{currencySymbol}{totalIncome.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-bold text-red-800 text-sm">Total Expense</h3>
                <p className="text-2xl font-bold text-red-600">{currencySymbol}{totalExpense.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-lg border ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <h3 className={`font-bold text-sm ${balance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Net Balance</h3>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{currencySymbol}{balance.toFixed(2)}</p>
            </div>
        </section>

        <section className="mb-6">
            <h2 className="text-xl font-semibold mb-2 text-gray-800 border-b pb-1">Expense Breakdown</h2>
            {pieChartData.length > 0 ? (
              <div className="flex flex-row items-center mt-4 gap-4">
                <div style={{ width: '300px', height: '300px' }}>
                  <PieChart width={300} height={300}>
                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label isAnimationActive={false}>
                      {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`} />
                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                  </PieChart>
                </div>
                <div className="flex-grow pl-4">
                  <table className="w-full text-sm text-left">
                    <thead><tr className="bg-gray-100"><th className="p-2 font-semibold text-black">Category</th><th className="p-2 font-semibold text-black">Amount</th><th className="p-2 font-semibold text-black text-right">% of Total</th></tr></thead>
                    <tbody className="text-gray-700">
                      {tableCategoryData.map(item => (
                        <tr key={item.name} className="border-b">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{currencySymbol}{item.value.toFixed(2)}</td>
                          <td className="p-2 text-right">{totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <p className="text-center p-4 text-gray-500 text-sm mt-4">No expense data to display for this period.</p>}
        </section>
        
        <section className="grid grid-cols-2 gap-6 mb-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-1 mb-2">Your Progress</h3>
                <div className="text-sm space-y-2 text-gray-600 bg-gray-50 p-3 rounded-lg border">
                  <p><strong>Level:</strong> {level} ({xp}% to next)</p>
                  <p><strong>Current Streak:</strong> {streaks.current} days</p>
                  <p><strong>Best Streak:</strong> {streaks.longest} days</p>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-1 mb-2">Key Highlights</h3>
                <div className="text-sm space-y-2 text-gray-600">
                  <div className="p-2 bg-red-50 rounded border border-red-100">
                    <p className="font-bold text-red-700">Largest Expense</p>
                    <p>{largestExpense.amount > 0 ? `${largestExpense.category}: ${currencySymbol}${largestExpense.amount.toFixed(2)}` : 'N/A'}</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded border border-green-100">
                    <p className="font-bold text-green-700">Largest Income</p>
                    <p>{largestIncome.amount > 0 ? `${largestIncome.category}: ${currencySymbol}${largestIncome.amount.toFixed(2)}` : 'N/A'}</p>
                  </div>
                </div>
            </div>
        </section>
        
        <section className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h2 className="text-xl font-semibold text-indigo-700 mb-2">Fin's Thoughts</h2>
            <p className="text-gray-700 text-sm">
              {isAiLoading ? 'Generating personalized insights...' : aiSummary}
            </p>
        </section>

        <footer className="text-center text-xs text-gray-400 mt-auto pt-4 border-t">
          <p>This report was generated by FinQuest AI. Total transactions in this period: {transactions.length}.</p>
          <p>&copy; {new Date().getFullYear()} FinQuest AI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default ReportGenerator;