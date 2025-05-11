import { supabase } from './supabaseClient';

/**
 * Aplica o trigger SQL para garantir que todas as senhas sejam 123456
 * e atualiza registros existentes
 */
export const enforceDefaultPassword = async () => {
  try {
    console.log('Aplicando regra de senha padrão 123456...');
    
    // Chamar a função Edge que aplica a trigger e atualiza as senhas
    const { data, error } = await supabase.functions.invoke('trigger_sql', {
      body: { 
        action: 'enforce_default_password'
      }
    });

    if (error) {
      console.error('Erro ao aplicar senha padrão:', error);
      return { success: false, error };
    }

    console.log('Resposta da função:', data);
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao executar enforceDefaultPassword:', err);
    return { success: false, error: err };
  }
}; 