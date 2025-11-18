

import { GoogleGenAI } from "@google/genai";
import { Transaction } from '../types';
import { Currency } from '../constants';

// Fix: Provided a fallback placeholder for the API key to prevent a crash on startup
// in environments where process.env is not defined.
const API_KEY = process.env.API_KEY || 'placeholder_api_key';
const ai = new GoogleGenAI({ apiKey: API_KEY });


const generateFinancialInsight = async (transactions: Transaction[], currency: Currency): Promise<string> => {
  // Add a check to fail gracefully if the API key is just a placeholder.
  if (API_KEY === 'placeholder_api_key') {
    return "✨ Fin's AI features are currently offline. Please check the API key configuration.";
  }
  
  const model = 'gemini-2.5-flash';

  const simplifiedTransactions = transactions.map(({ type, category, amount, date }) => ({
    type,
    category,
    amount,
    date: new Date(date).toLocaleDateString(),
  }));

  const prompt = `
    Act as a friendly and encouraging AI financial coach named Fin.
    Your tone should be positive and gamified, like a helpful character in a finance adventure game.
    Analyze the following list of recent financial transactions. The amounts are in ${currency}.

    Based on the data, provide a short, easy-to-read analysis covering these points:
    1.  **Overall Summary:** A brief, encouraging summary of the user's financial activity.
    2.  **Top Spending Category:** Identify the category where the most money was spent.
    3.  **Actionable Tip:** Suggest one simple, practical tip for saving money based on their spending. When mentioning amounts, use the ${currency} currency symbol.
    4.  **Financial Quest:** Frame the tip as a fun "quest" or "challenge".

    Keep the entire response under 150 words. Use emojis to make it engaging.

    Transaction Data:
    ${JSON.stringify(simplifiedTransactions, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Error generating content from Gemini:", error);
    throw new Error("Failed to communicate with the AI assistant.");
  }
};

const generatePdfSummary = async (transactions: Transaction[], totalIncome: number, totalExpense: number, currency: Currency): Promise<string> => {
  if (API_KEY === 'placeholder_api_key') {
    return "AI summary is unavailable because the API key has not been configured.";
  }
  
  const model = 'gemini-2.5-flash';
  const simplifiedTransactions = transactions.slice(0, 20).map(({ type, category, amount, date }) => ({
    type, category, amount, date: new Date(date).toLocaleDateString()
  }));

  const prompt = `
    Act as an expert financial analyst named Fin, providing a summary for a formal PDF report.
    Your tone should be insightful, clear, and professional, but still encouraging.
    Analyze the provided financial data for the period. The currency is ${currency}.

    Based on the data, provide a concise summary (under 80 words) covering:
    1. A brief overview of the user's financial performance (income vs. expense).
    2. A key observation about their spending habits (e.g., "spending was concentrated in...").
    3. A forward-looking, positive concluding remark.

    Do not use emojis. Do not frame it as a "quest". This is for a formal report.

    Financial Data:
    Total Income: ${totalIncome}
    Total Expense: ${totalExpense}
    Sample Transactions:
    ${JSON.stringify(simplifiedTransactions, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating PDF summary from Gemini:", error);
    throw new Error("Failed to generate AI summary for the report.");
  }
};


export const geminiService = {
  generateFinancialInsight,
  generatePdfSummary,
};