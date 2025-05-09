import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Cabeçalhos CORS simplificados
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

console.log("Função stripe-checkout-jwt inicializada");

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
    // Verificação do Stripe Secret Key
    if (!stripeSecretKey) {
      console.error("[ERROR] Chave secreta do Stripe não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor de pagamento ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicialização do cliente Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Inicialização do cliente Supabase para verificação de JWT
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[ERROR] Variáveis de ambiente do Supabase não configuradas");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extração do JWT do cabeçalho de autorização (opcional)
    const authHeader = req.headers.get("authorization");
    
    // Verificação do usuário (opcional)
    let user = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const { data: { user: userData }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && userData) {
        user = userData;
        console.log(`[INFO] Usuário autenticado: ${user.id}`);
      } else {
        console.log("[INFO] Token JWT inválido ou expirado, continuando como anônimo");
      }
    } else {
      console.log("[INFO] Sem token JWT, continuando como anônimo");
    }

    // Extrai os dados do corpo da requisição
    let requestData;
    try {
      requestData = await req.json();
      console.log(`[INFO] Dados recebidos: ${JSON.stringify(requestData)}`);
    } catch (error) {
      console.error(`[ERROR] Erro ao processar o corpo da requisição: ${error.message}`);
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Extrai o ID do preço
    const { price_id, success_url, cancel_url } = requestData;
    if (!price_id) {
      console.error("[ERROR] ID do preço não fornecido");
      return new Response(
        JSON.stringify({ error: "O ID do preço é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[INFO] Criando sessão para price_id: ${price_id}`);
    console.log(`[INFO] Success URL: ${success_url || "padrão"}`);
    console.log(`[INFO] Cancel URL: ${cancel_url || "padrão"}`);

    // Cria uma sessão de checkout no Stripe
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: price_id, quantity: 1 }],
        mode: "subscription",
        success_url: success_url || `${req.headers.get("origin") || "https://driverincontrol.com.br"}/checkout-success`,
        cancel_url: cancel_url || `${req.headers.get("origin") || "https://driverincontrol.com.br"}/checkout-cancel`,
        customer_creation: "always",
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (stripeError) {
      console.error(`[STRIPE_ERROR] ${stripeError.type || 'UnknownError'}: ${stripeError.message}`);
      
      // Retorna o erro específico do Stripe
      return new Response(
        JSON.stringify({
          error: stripeError.message || "Erro no processamento do Stripe",
          type: stripeError.type || null,
          code: stripeError.code || null
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error(`[ERROR] Erro geral: ${error.message}`);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}); 