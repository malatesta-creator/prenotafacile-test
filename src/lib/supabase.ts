import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURAZIONE SUPABASE (DATABASE)
// ------------------------------------------------------------------

// 1. Incolla qui il "Project URL" (trovato su Supabase > API Settings)
const supabaseUrl = 'https://emfvodkfnttnphxqwnsd.supabase.co'; 

// 2. Incolla qui la "Publishable Key" (trovata su Supabase > API Settings)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtZnZvZGtmbnR0bnBoeHF3bnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzUxOTcsImV4cCI6MjA3OTc1MTE5N30.7gpxlj-UJ-SIqCeFqR5olY5Tsh41jcO5anq2Grn2Cv4';

// Crea la connessione al database
// @ts-ignore
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
