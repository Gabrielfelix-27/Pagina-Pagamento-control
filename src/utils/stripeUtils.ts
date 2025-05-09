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
    const successUrl = ensureValidUrl(`${window.location.origin}/success`);
    const cancelUrl = ensureValidUrl(`${window.location.origin}/cancel`);
    
    console.log(`URL de sucesso: ${successUrl}`);
    console.log(`URL de cancelamento: ${cancelUrl}`);
    
    // Chama a função Edge do Stripe para criar uma sessão de checkout
    console.log('Chamando função Edge do Supabase...');
    
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        price_id: priceId,
        success_url: successUrl,
        cancel_url: cancelUrl
      }
    });

    console.log('Resposta da função Edge:', { data, error });

    // Verifica se houve erro na invocação da função
    if (error) {
      console.error('Erro na Edge Function:', error);
      
      // Tenta extrair informações mais detalhadas sobre o erro
      let errorMessage = 'Erro na conexão com o servidor';
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.status === 401) {
        errorMessage = 'Erro de autenticação no servidor. Tente fazer login novamente.';
      } else if (error.status === 403) {
        errorMessage = 'Sem permissão para acessar o serviço de pagamento.';
      } else if (error.status === 404) {
        errorMessage = 'Serviço de pagamento não encontrado ou não configurado.';
      } else if (error.status === 500) {
        errorMessage = 'Erro interno no servidor de pagamento. Tente novamente mais tarde.';
      } else if (error.status === 503) {
        errorMessage = 'Serviço de pagamento temporariamente indisponível. Tente novamente mais tarde.';
      }
      
      throw new Error(`Erro ao criar sessão: ${errorMessage}`);
    }

    // Verifica se a resposta contém um erro específico do Stripe
    if (data && data.error) {
      console.error('Erro retornado pelo Stripe:', data.error);
      
      // Tenta traduzir alguns erros comuns do Stripe
      let errorMessage = data.error;
      if (typeof data.error === 'string') {
        if (data.error.includes('Invalid API Key')) {
          errorMessage = 'Chave de API do Stripe inválida. Informe ao suporte.';
        } else if (data.error.includes('rate limit')) {
          errorMessage = 'Muitas tentativas de pagamento. Aguarde um momento e tente novamente.';
        } else if (data.error.includes('No such price')) {
          errorMessage = 'Plano não encontrado. Informe ao suporte.';
        } else if (data.error.includes('Not a valid URL')) {
          errorMessage = 'URL de redirecionamento inválida. Informe ao suporte.';
        } else if (data.error.includes('customer_creation')) {
          errorMessage = 'Erro de configuração do checkout. Informe ao suporte.';
        }
      }
      
      throw new Error(`Erro de pagamento: ${errorMessage}`);
    }
    
    // Verifica se a resposta contém os dados necessários
    if (!data || !data.url) {
      console.error('Resposta inválida do servidor:', data);
      throw new Error('Resposta inválida do servidor de pagamento');
    }
    
    console.log(`Sessão criada com sucesso. URL: ${data.url.substring(0, 60)}...`);
    
    // Retorna os dados necessários para o redirecionamento
    return {
      url: data.url,
      sessionId: data.sessionId
    };
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    
    // Se o erro for uma instância de Error, usa sua mensagem
    // Caso contrário, fornece uma mensagem genérica
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Erro na conexão com o servidor de pagamento. Por favor, tente novamente mais tarde.');
    }
  }
};