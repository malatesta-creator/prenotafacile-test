import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://emfvodkfnttnphxqwnsd.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtZnZvZGtmbnR0bnBoeHF3bnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzUxOTcsImV4cCI6MjA3OTc1MTE5N30.7gpxlj-UJ-SIqCeFqR5olY5Tsh41jcO5anq2Grn2Cv4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
