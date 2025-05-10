import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

serve(async (req) => {
  // Responder a requisições OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Obter a URL de onde viemos
    const url = new URL(req.url);
    const params = url.searchParams;
    
    console.log(`[REDIRECT-HANDLER] URL recebida: ${req.url}`);

    // Verificar se é um redirecionamento de sucesso do Stripe
    const hasSuccessParam = params.has('success') || params.has('session_id');
    const hasCredentialsParam = params.has('credentials');
    const hasUserExistsParam = params.has('user_already_exists');
    
    // Se não tiver nenhum dos parâmetros necessários, redirecionar para a página inicial
    if (!hasSuccessParam && !hasCredentialsParam && !hasUserExistsParam) {
      console.log('[REDIRECT-HANDLER] Sem parâmetros de sucesso ou credenciais. Redirecionando para a página inicial.');
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": "/"
        }
      });
    }

    // Montar a nova URL
    const baseUrl = `${url.protocol}//${url.host}`;
    let redirectUrl = `${baseUrl}/payment-confirmation`;
    
    // Adicionar parâmetros existentes à nova URL
    const newParams = new URLSearchParams();
    
    // Copiar todos os parâmetros existentes
    for (const [key, value] of params.entries()) {
      newParams.append(key, value);
    }
    
    // URL final com todos os parâmetros
    const finalRedirectUrl = `${redirectUrl}?${newParams.toString()}`;
    
    console.log(`[REDIRECT-HANDLER] Redirecionando para: ${finalRedirectUrl}`);
    
    // Redirecionar para a nova URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": finalRedirectUrl
      }
    });
  } catch (error) {
    console.error(`[ERROR] Erro ao processar redirecionamento: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        error: "Erro no processamento do redirecionamento",
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}); 