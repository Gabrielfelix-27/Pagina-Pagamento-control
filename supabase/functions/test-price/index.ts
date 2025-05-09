import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";

// Cabeçalhos CORS simplificados
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET"
};

console.log("Função Edge inicializada");

serve(async (req) => {
  console.log(`Recebida requisição: ${req.method} ${req.url}`);

  // Responde a requisições preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    // Log da requisição
    console.log("Testando acesso ao Stripe em:", new Date().toISOString());
    
    // Verificando as variáveis de ambiente disponíveis
    const stripeKey = Deno.env.get("STRIPE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    // Verificando qual chave está disponível
    console.log("STRIPE_KEY disponível:", !!stripeKey);
    console.log("STRIPE_SECRET_KEY disponível:", !!stripeSecretKey);
    
    // Se nenhuma chave estiver disponível, retornamos um erro
    if (!stripeKey && !stripeSecretKey) {
      console.error("Nenhuma chave do Stripe configurada");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor de pagamento ausente" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Inicializa o Stripe com a chave disponível
    const stripe = new Stripe(stripeKey || stripeSecretKey || "", {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Testa a recuperação de um preço
    try {
      const price = await stripe.prices.retrieve("price_1RMD9JRwUl4uJKT1zQX7jua7");
      console.log("Preço recuperado com sucesso:", price.id);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Preço encontrado com sucesso",
          price: {
            id: price.id,
            amount: price.unit_amount,
            currency: price.currency,
            nickname: price.nickname,
            type: price.type,
            product: price.product
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (priceError) {
      console.error("Erro ao recuperar preço:", priceError);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: "Falha ao recuperar preço",
          error: priceError.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Erro na função:", error);
    
    // Retorna o erro
    return new Response(
      JSON.stringify({
        error: error.message || "Erro interno do servidor",
        type: error.type || null,
        code: error.code || null,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 