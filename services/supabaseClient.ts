import { createClient } from '@supabase/supabase-js';

// --- Environment Variables ---
// These are automatically injected by the environment.
const supabaseUrl = process.env.SUPABASE_URL || "https://nkfkiummlqfudbhsjlni.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZmtpdW1tbHFmdWRiaHNqbG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzE1MzYsImV4cCI6MjA3ODYwNzUzNn0.CNGqrxfi31SiNnyZa4BMpFuv9Eqdwt0-kuG_wDH48zA";

console.log("url: ", supabaseUrl, "Anon: ", supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in environment variables.");
}

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
