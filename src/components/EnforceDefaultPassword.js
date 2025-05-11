import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * Componente invisível que garante que todas as senhas são padronizadas como "123456"
 * Este componente é carregado no app principal e executa automaticamente
 */
const EnforceDefaultPassword = () => {
  const [status, setStatus] = useState('idle');
  
  useEffect(() => {
    const enforceDefaultPassword = async () => {
      try {
        setStatus('running');
        console.log('Aplicando regra de senha padrão 123456...');
        
        // Atualizar todas as senhas existentes na tabela para 123456
        const { error: updateError } = await supabase
          .from('payment_credentials')
          .update({ password: '123456' })
          .neq('password', '123456');
          
        if (updateError) {
          console.error('Erro ao atualizar senhas existentes:', updateError);
          setStatus('error');
          return;
        }
        
        console.log('Senhas existentes atualizadas com sucesso!');
        
        // Recuperar uma senha aleatória para verificar se funcionou
        const { data: sampleData, error: sampleError } = await supabase
          .from('payment_credentials')
          .select('password')
          .limit(1)
          .single();
          
        if (sampleError) {
          console.warn('Aviso: Não foi possível verificar uma amostra de senha:', sampleError);
        } else {
          console.log('Exemplo de senha na tabela:', sampleData.password);
        }
        
        setStatus('success');
      } catch (err) {
        console.error('Erro ao executar enforceDefaultPassword:', err);
        setStatus('error');
      }
    };
    
    enforceDefaultPassword();
  }, []);
  
  // Este componente não renderiza nada visualmente
  return null;
};

export default EnforceDefaultPassword; 