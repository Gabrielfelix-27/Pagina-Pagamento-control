import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
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
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter parâmetros da requisição
    const url = new URL(req.url);
    let paymentId = url.searchParams.get("payment_id");
    
    // Se for POST, tentar obter do corpo
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && body.payment_id) {
          paymentId = body.payment_id;
        }
      } catch (err) {
        console.error("Erro ao ler corpo da requisição:", err);
      }
    }

    // Verificar se temos um ID de pagamento
    if (!paymentId) {
      return new Response(
        JSON.stringify({ 
          error: "ID de pagamento não fornecido",
          message: "Forneça um payment_id na consulta ou no corpo da requisição"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[INFO] Recuperando credenciais para pagamento: ${paymentId}`);

    // Primeiro método: tentar na tabela payment_credentials
    const { data: credentials, error: credentialsError } = await supabase
      .rpc('get_payment_credentials', { p_payment_id: paymentId });

    if (credentialsError) {
      console.error(`[ERROR] Erro ao buscar credenciais: ${credentialsError.message}`);
    }

    // Se encontramos credenciais, retorná-las
    if (credentials && credentials.length > 0) {
      console.log(`[SUCCESS] Credenciais encontradas para pagamento ${paymentId}`);
      return new Response(
        JSON.stringify({ 
          success: true,
          data: credentials[0]
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Segundo método: tentar encontrar no storage (método alternativo)
    try {
      const { data: storageData, error: storageError } = await supabase.storage
        .from('redirects')
        .download(`${paymentId}.json`);

      if (storageError) {
        console.error(`[ERROR] Erro ao buscar do storage: ${storageError.message}`);
      } else if (storageData) {
        const text = await storageData.text();
        const jsonData = JSON.parse(text);
        
        console.log(`[SUCCESS] Dados encontrados no storage para ${paymentId}`);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              email: jsonData.email,
              password: jsonData.password,
              redirect_url: jsonData.redirectUrl
            },
            source: 'storage'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    } catch (storageErr) {
      console.error(`[ERROR] Exceção ao tentar storage: ${storageErr.message}`);
    }

    // Terceiro método: tentar recuperar dados do cliente no Stripe
    try {
      const Stripe = (await import("https://esm.sh/stripe@12.9.0?target=deno")).default;
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      
      if (!stripeSecretKey) {
        throw new Error("STRIPE_SECRET_KEY não está configurada");
      }
      
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });
      
      // Buscar dados da sessão/pagamento
      let customerIdToSearch;
      
      // Tentar primeiro como session_id
      try {
        const session = await stripe.checkout.sessions.retrieve(paymentId);
        if (session && session.customer) {
          customerIdToSearch = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer.id;
        }
      } catch (sessionErr) {
        console.log(`[INFO] Não é uma sessão válida: ${sessionErr.message}`);
        
        // Tentar como payment_intent_id
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
          if (paymentIntent && paymentIntent.customer) {
            customerIdToSearch = typeof paymentIntent.customer === 'string' 
              ? paymentIntent.customer 
              : paymentIntent.customer.id;
          }
        } catch (piErr) {
          console.log(`[INFO] Não é um payment_intent válido: ${piErr.message}`);
        }
      }
      
      // Se temos um ID de cliente, buscar metadados
      if (customerIdToSearch) {
        console.log(`[INFO] Buscando cliente ${customerIdToSearch} no Stripe`);
        const customer = await stripe.customers.retrieve(customerIdToSearch);
        
        if (customer && customer.metadata) {
          console.log(`[INFO] Metadados encontrados para cliente ${customerIdToSearch}`);
          
          // Verificar se há dados úteis nos metadados
          if (customer.metadata.userId && (
              customer.metadata.tempPassword || 
              customer.metadata.password || 
              customer.metadata.redirectUrl
          )) {
            const email = customer.email;
            const password = customer.metadata.tempPassword || customer.metadata.password;
            const redirectUrl = customer.metadata.redirectUrl;
            
            console.log(`[SUCCESS] Recuperados dados do Stripe para ${email}`);
            
            // Armazenar para futuras recuperações
            try {
              await supabase
                .from('payment_credentials')
                .upsert({
                  payment_id: paymentId,
                  email: email,
                  password: password,
                  redirect_url: redirectUrl,
                  created_at: new Date().toISOString()
                });
            } catch (insertErr) {
              console.error(`[ERROR] Erro ao salvar dados recuperados: ${insertErr.message}`);
            }
            
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  email: email,
                  password: password,
                  redirect_url: redirectUrl
                },
                source: 'stripe'
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }
        }
      }
    } catch (stripeErr) {
      console.error(`[ERROR] Erro ao buscar no Stripe: ${stripeErr.message}`);
    }

    // Se chegamos aqui, não encontramos as credenciais
    console.log(`[WARN] Credenciais não encontradas para pagamento ${paymentId}`);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Credenciais não encontradas",
        message: "Não foi possível recuperar os dados para este pagamento"
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error(`[ERROR] Erro geral: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Erro interno do servidor",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}); 