// Follow this setup guide to integrate the Deno runtime into your project:
// https://deno.com/manual/getting_started/setup_your_environment

// This example uses the serve() helper method:
// https://deno.com/manual/runtime/http/server

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";

// Cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// Inicialização do Stripe
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient()
});

serve(async (req) => {
  // Responder a requisições OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Obter dados da requisição
    const requestData = await req.json();
    console.log("Dados recebidos:", requestData);

    // Validar dados obrigatórios
    if (!requestData.price_id) {
      return new Response(
        JSON.stringify({ error: "O ID do preço é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Extrair informações da requisição
    const priceId = requestData.price_id;
    const successUrl = requestData.success_url || "http://localhost:5173/payment-confirmation";
    const cancelUrl = requestData.cancel_url || "http://localhost:5173/cancel";

    console.log(`Criando sessão de checkout para o preço: ${priceId}`);
    console.log(`URL de sucesso: ${successUrl}`);
    console.log(`URL de cancelamento: ${cancelUrl}`);

    // Criar uma sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true
    });

    console.log("Sessão de checkout criada:", session.id);

    // Retornar a sessão
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
  } catch (error) {
    console.error("Erro ao criar sessão de checkout:", error.message);
    
    return new Response(
      JSON.stringify({
        error: "Erro ao criar sessão de checkout",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});