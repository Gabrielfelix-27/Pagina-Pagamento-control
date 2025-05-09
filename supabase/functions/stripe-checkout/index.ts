// Follow this setup guide to integrate the Deno runtime into your project:
// https://deno.com/manual/getting_started/setup_your_environment

// This example uses the serve() helper method:
// https://deno.com/manual/runtime/http/server

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";

// Cabeçalhos CORS simplificados
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

console.log("[✓] Função stripe-checkout inicializada");

// Função para detectar ambiente
function detectEnvironment() {
  const host = Deno.env.get("CLIENT_URL") || "";
  const isProduction = host.includes("driverincontrol.com.br") || host.includes("prod");
  return {
    isProduction,
    environment: isProduction ? "production" : "test"
  };
}

// Função para garantir que as URLs tenham o formato correto para o Stripe
function ensureValidUrl(url: string | null | undefined, defaultDomain: string, defaultPath: string): string {
  if (!url) {
    return `https://${defaultDomain}${defaultPath}`;
  }
  
  // Verificar se a URL começa com http:// ou https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${defaultDomain}${url.startsWith('/') ? url : '/' + url}`;
  }

  // Se já é uma URL completa, retornar como está
  return url;
}

serve(async (req) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);

  // Responde a requisições preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
    }

  try {
    // Log da requisição
    console.log(`[INFO] Processando checkout em: ${new Date().toISOString()}`);
    
    // Verificar ambiente
    const { isProduction, environment } = detectEnvironment();
    console.log(`[INFO] Executando em ambiente: ${environment}`);
    
    // Usar apenas STRIPE_SECRET_KEY para operações de backend
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    // Máscara para logs seguros
    const maskKey = (key) => key ? `${key.substring(0, 5)}...${key.substring(key.length - 4)}` : "não configurado";
    console.log(`[INFO] STRIPE_SECRET_KEY: ${maskKey(stripeSecretKey)}`);
    
    // Verificar se a chave começa com 'sk_test_' para ambiente de teste
    if (!isProduction && stripeSecretKey && !stripeSecretKey.startsWith('sk_test_')) {
      console.error("[ERROR] Usando chave de produção em ambiente de teste!");
      return new Response(
        JSON.stringify({ error: "Configuração incorreta de ambiente" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se a chave começa com 'sk_live_' para ambiente de produção
    if (isProduction && stripeSecretKey && !stripeSecretKey.startsWith('sk_live_')) {
      console.warn("[WARN] Usando chave de teste em ambiente de produção!");
      // Continuamos mesmo com o aviso - não é um erro crítico
    }
    
    // Verificar se a chave secreta está disponível
    if (!stripeSecretKey) {
      console.error("[ERROR] Chave secreta do Stripe não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor de pagamento ausente" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Inicializa o Stripe com a chave secreta
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Extrai os dados do corpo da requisição
    let requestData;
        try {
      requestData = await req.json();
      console.log(`[INFO] Dados recebidos: ${JSON.stringify(requestData)}`);
    } catch (error) {
      console.error(`[ERROR] Erro ao processar o corpo da requisição: ${error.message}`);
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
      }

    // Extrai o ID do preço
    const { price_id, success_url, cancel_url } = requestData;
    if (!price_id) {
      console.error("[ERROR] ID do preço não fornecido");
      return new Response(
        JSON.stringify({ error: "O ID do preço é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Verificar se o price_id é do mesmo ambiente que a chave
    if (!isProduction && !price_id.startsWith('price_') && price_id.includes('_live_')) {
      console.error("[ERROR] Usando price_id de produção com chave de teste");
      return new Response(
        JSON.stringify({ error: "ID de preço incompatível com o ambiente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (isProduction && !price_id.startsWith('price_') && price_id.includes('_test_')) {
      console.error("[ERROR] Usando price_id de teste com chave de produção");
      return new Response(
        JSON.stringify({ error: "ID de preço incompatível com o ambiente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Determinar o domínio padrão
    const defaultDomain = isProduction ? "driverincontrol.com.br" : req.headers.get("origin")?.replace(/^https?:\/\//, '') || "localhost";
    
    // Construir URLs válidas para o Stripe
    const validSuccessUrl = ensureValidUrl(success_url, defaultDomain, "/checkout-success");
    const validCancelUrl = ensureValidUrl(cancel_url, defaultDomain, "/checkout-cancel");
    
    console.log(`[INFO] Criando sessão para price_id: ${price_id}`);
    console.log(`[INFO] Success URL: ${validSuccessUrl}`);
    console.log(`[INFO] Cancel URL: ${validCancelUrl}`);

    // Cria uma sessão de checkout no Stripe
    try {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ 
          price: price_id,
          quantity: 1 
        }],
        mode: "subscription",
        success_url: validSuccessUrl,
        cancel_url: validCancelUrl,
        billing_address_collection: "required",
        allow_promotion_codes: true,
        locale: "pt-BR"
    });

      console.log(`[SUCCESS] Sessão criada com sucesso: ${session.id}`);
      console.log(`[SUCCESS] URL de checkout: ${session.url?.substring(0, 50)}...`);

      // Retorna o ID da sessão e a URL de redirecionamento
      return new Response(
        JSON.stringify({ 
          sessionId: session.id,
          url: session.url 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } catch (stripeError) {
      console.error(`[STRIPE_ERROR] ${stripeError.type || 'UnknownError'}: ${stripeError.message}`);
      console.error(`[STRIPE_ERROR] Detalhes completos: ${JSON.stringify(stripeError)}`);
      
      // Retorna o erro específico do Stripe
      return new Response(
        JSON.stringify({
          error: stripeError.message || "Erro no processamento do Stripe",
          type: stripeError.type || null,
          code: stripeError.code || null,
          decline_code: stripeError.decline_code || null,
          param: stripeError.param || null
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
  } catch (error) {
    console.error(`[ERROR] Erro geral: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
    
    return new Response(
      JSON.stringify({ 
        error: "Erro interno do servidor",
        message: error.message || "Erro desconhecido"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});