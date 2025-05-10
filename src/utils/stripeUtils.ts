import { supabase } from './supabaseClient';

// Garante que a URL tenha o formato correto para o Stripe
function ensureValidUrl(url: string): string {
  // Verificar se a URL já começa com http:// ou https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Adiciona o protocolo https:// se não existir
    return `https://${url.startsWith('//') ? url.substring(2) : url}`;
  }
  return url;
}

export const createCheckoutSession = async (priceId: string) => {
  try {
    console.log(`Iniciando checkout para o priceId: ${priceId}`);
    
    // Detecta ambiente
    const isProduction = window.location.hostname.includes('driverincontrol.com.br');
    console.log(`Executando em ambiente: ${isProduction ? 'produção' : 'teste'}`);
    
    // Verifica se o priceId é compatível com o ambiente
    if (isProduction && priceId.includes('_test_')) {
      console.error('ERRO DE AMBIENTE: Usando ID de preço de teste em ambiente de produção');
      throw new Error('Configuração incorreta do sistema. Entre em contato com o suporte.');
    }
    
    if (!isProduction && priceId.includes('_live_')) {
      console.error('ERRO DE AMBIENTE: Usando ID de preço de produção em ambiente de teste');
      throw new Error('Configuração incorreta do sistema. Entre em contato com o suporte.');
    }
    
    // Construa URLs absolutas de sucesso e cancelamento
    // Modificado para usar payment-confirmation em vez de success
    const successUrl = ensureValidUrl(`${window.location.origin}/payment-confirmation`);
    const cancelUrl = ensureValidUrl(`${window.location.origin}/cancel`);
    
    console.log(`URL de sucesso: ${successUrl}`);
    console.log(`URL de cancelamento: ${cancelUrl}`);
    
    // Lista de funções para tentar, em ordem de prioridade
    const functionList = ['stripe-checkout', 'stripe-checkout-jwt'];
    
    // Tenta cada função na lista até uma funcionar
    for (let i = 0; i < functionList.length; i++) {
      const functionName = functionList[i];
      
      try {
        console.log(`Tentando função: ${functionName}`);
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {
            price_id: priceId,
            success_url: successUrl,
            cancel_url: cancelUrl
          }
        });
        
        if (error) {
          console.error(`Erro na função ${functionName}:`, error);
          // Não lança erro aqui, continua para a próxima função
          continue;
        }
        
        if (!data) {
          console.error(`Nenhum dado retornado pela função ${functionName}`);
          // Não lança erro aqui, continua para a próxima função
          continue;
        }
        
        console.log(`Sessão criada com sucesso via ${functionName}:`, data);
        return data;
      } catch (funcError) {
        console.error(`Erro ao chamar função ${functionName}:`, funcError);
        // Não lança erro aqui, continua para a próxima função
      }
    }
    
    // Se chegou aqui, todas as funções falharam
    throw new Error('Todas as tentativas de checkout falharam. Tente novamente mais tarde.');
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    throw error;
  }
};