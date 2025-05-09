import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";

// Cabeçalhos CORS para permitir acesso de qualquer origem
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

console.log("Função de teste de Stripe Checkout inicializada");

serve(async (req) => {
  // Log da requisição recebida
  console.log(`Recebida requisição ${req.method} em ${new Date().toISOString()}`);
  
  // Tratamento de requisições OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    // Verificação da chave secreta
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    console.log(`Chave encontrada: ${stripeSecretKey ? "Sim" : "Não"}`);
    
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Chave do Stripe não configurada" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Inicialização do cliente Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient()
    });

    console.log("Cliente Stripe inicializado com sucesso");

    // Extração do body da requisição
    const requestData = await req.json().catch(() => ({}));
    console.log("Dados recebidos:", JSON.stringify(requestData));

    // Extração dos parâmetros necessários
    const priceId = requestData.price_id || "price_1RMD9JRwUl4uJKT1zQX7jua7"; // ID do preço padrão
    const successUrl = requestData.success_url || `${req.headers.get("origin") || "https://driverincontrol.com.br"}/checkout-success`;
    const cancelUrl = requestData.cancel_url || `${req.headers.get("origin") || "https://driverincontrol.com.br"}/checkout-cancel`;

    console.log(`Usando price_id: ${priceId}`);
    console.log(`Success URL: ${successUrl}`);
    console.log(`Cancel URL: ${cancelUrl}`);

    // Criação da sessão de checkout
    console.log("Criando sessão de checkout...");
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_creation: "always",
      locale: "pt-BR"
    });

    console.log(`Sessão criada: ${session.id}`);
    console.log(`URL de checkout: ${session.url}`);

    // Retorno do resultado
    return new Response(
      JSON.stringify({ 
        success: true,
        sessionId: session.id,
        url: session.url 
      }),
      { status: 200, headers: corsHeaders }
    );
    
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Erro desconhecido",
        details: error.type || error.code || null
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}); 