import { createClient } from '@supabase/supabase-js';

// Chaves públicas (publishable) do projeto Supabase "Mao Quan Conecta".
// A segurança dos dados é garantida pelas regras de RLS no banco, não por esconder esta chave.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://irdpkooaqxjmnbovhblm.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kbhRiVYz3WdA9IxBY_Y4mw_8Lpkhmhm';

export const supabase = createClient(URL, KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
