import { createClient } from '@supabase/supabase-js';

// Obtém as variáveis de ambiente do Supabase 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verifica se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variáveis de ambiente do Supabase não definidas! Verifique o arquivo .env');
}

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  }
});

// Função de utilidade para verificar se o usuário está autenticado
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session !== null;
};

// Função para verificar as credenciais de um pagamento
export const getPaymentCredentials = async (paymentId: string) => {
  try {
    return await supabase.functions.invoke('get-payment-credentials', {
      body: { payment_id: paymentId }
    });
  } catch (error) {
    console.error('Erro ao recuperar credenciais:', error);
    throw error;
  }
};