import { createClient } from '@supabase/supabase-js';

// --- Variabili di Ambiente ---
// Queste variabili DEVONO essere definite nel tuo file .env (o equivalenti per il frontend)
// e poi lette dal tuo server o dal tuo ambiente di build.
// DOVRAI sostituire i valori placeholder con le tue chiavi reali di Supabase.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Verifica di sicurezza (utile in TypeScript)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Le variabili di ambiente SUPABASE_URL e SUPABASE_ANON_KEY devono essere definite.');
}

// Inizializza il client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Esempio di funzione che potresti creare in seguito (funzione placeholder)
// export const fetchServices = async () => {
//   const { data, error } = await supabase
//     .from('services') // 'services' è il nome della tua tabella sul database
//     .select('*');

//   if (error) {
//     console.error('Errore nel recupero dei servizi:', error);
//     return [];
//   }
//   return data;
// };
