import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURAZIONE SUPABASE (DATABASE)
// ------------------------------------------------------------------

// 1. Incolla qui il "Project URL" (es. https://xyz.supabase.co)
const supabaseUrl = 'INCOLLA_QUI_IL_PROJECT_URL'; 

// 2. Incolla qui la "Publishable Key" (es. eyJxh...)
const supabaseAnonKey = 'INCOLLA_QUI_LA_PUBLISHABLE_KEY';

// Controllo di sicurezza
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('INCOLLA')) {
  console.error('⚠️ ATTENZIONE: Chiavi Supabase mancanti in src/lib/supabase.ts');
}

// Crea la connessione al database
// @ts-ignore - Ignora errori TypeScript temporanei
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
