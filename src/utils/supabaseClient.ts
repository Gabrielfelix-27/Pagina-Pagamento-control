import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// Configuração do projeto ativo
const supabaseUrl = 'https://gyogfvfmsotveacjcckr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b2dmdmZtc290dmVhY2pjY2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQ0MTE1NzEsImV4cCI6MjAyOTk4NzU3MX0.aTsDXdgXqvQAoLzK8Nb6tJHhVmxcD7Isgr5sUuZWULk';

// Fallback para variáveis de ambiente, se configuradas
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(
  envUrl || supabaseUrl, 
  envAnonKey || supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);