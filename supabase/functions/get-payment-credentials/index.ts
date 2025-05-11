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
    } else {
      console.log(`[DEBUG] Resultado da busca de credenciais: ${JSON.stringify(credentials)}`);
    }

    // Se encontramos credenciais, retorná-las
    if (credentials && credentials.length > 0) {
      console.log(`[SUCCESS] Credenciais encontradas para pagamento ${paymentId}: ${JSON.stringify(credentials[0])}`);
      
      // Verifique se há dados válidos
      if (credentials[0].email) {
        return new Response(
          JSON.stringify({ 
            success: true,
            data: {
              ...credentials[0],
              password: "123456" // Sempre retornar a senha padrão, independente do que está no banco
            },
            source: 'database'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      } else {
        console.log(`[WARN] Credenciais encontradas mas sem email válido`);
      }
    } else {
      console.log(`[INFO] Nenhuma credencial encontrada na tabela payment_credentials`);
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
              password: "123456", // Sempre retornar a senha padrão
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
      
      console.log(`[INFO] Conectando ao Stripe para recuperar dados de ${paymentId}`);
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });
      
      // Buscar dados da sessão/pagamento
      let customerIdToSearch;
      let customerEmail;
      let paymentData = {};
      
      // Tentar primeiro como session_id
      try {
        console.log(`[INFO] Tentando recuperar como checkout.session: ${paymentId}`);
        const session = await stripe.checkout.sessions.retrieve(paymentId);
        console.log(`[INFO] Sessão encontrada: ${session.id}, status: ${session.status}`);
        
        if (session && session.customer) {
          customerIdToSearch = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer.id;
          
          // Tentar obter email do customer_details
          if (session.customer_details && session.customer_details.email) {
            customerEmail = session.customer_details.email;
            console.log(`[INFO] Email do cliente obtido dos customer_details: ${customerEmail}`);
          }
          
          paymentData = {
            session_id: session.id,
            payment_status: session.payment_status,
          };
        }
      } catch (sessionErr) {
        console.log(`[INFO] Não é uma sessão válida: ${sessionErr.message}`);
        
        // Tentar como payment_intent_id
        try {
          console.log(`[INFO] Tentando recuperar como paymentIntent: ${paymentId}`);
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
          console.log(`[INFO] PaymentIntent encontrado: ${paymentIntent.id}, status: ${paymentIntent.status}`);
          
          if (paymentIntent && paymentIntent.customer) {
            customerIdToSearch = typeof paymentIntent.customer === 'string' 
              ? paymentIntent.customer 
              : paymentIntent.customer.id;
            
            paymentData = {
              payment_intent_id: paymentIntent.id,
              payment_status: paymentIntent.status,
            };
          }
        } catch (piErr) {
          console.log(`[INFO] Não é um payment_intent válido: ${piErr.message}`);
        }
      }
      
      // Se temos um ID de cliente, buscar metadados
      if (customerIdToSearch) {
        console.log(`[INFO] Buscando cliente ${customerIdToSearch} no Stripe`);
        
        try {
          const customer = await stripe.customers.retrieve(customerIdToSearch);
          
          if (customer && !('deleted' in customer)) {
            console.log(`[INFO] Cliente encontrado: ${customer.id}, email: ${customer.email}`);
            
            // Usar o email do cliente se não tivermos obtido antes
            if (!customerEmail && customer.email) {
              customerEmail = customer.email;
            }
            
            if (customer.metadata) {
              console.log(`[INFO] Metadados encontrados para cliente ${customerIdToSearch}: ${JSON.stringify(customer.metadata)}`);
              
              // Verificar se há dados úteis nos metadados
              const password = customer.metadata.tempPassword || 
                               customer.metadata.temp_password || 
                               customer.metadata.password;
              
              if (customerEmail && password) {
                console.log(`[SUCCESS] Credenciais completas recuperadas do Stripe para ${customerEmail}`);
                
                // Armazenar para futuras recuperações
                try {
                  const { error: insertError } = await supabase
                    .from('payment_credentials')
                    .upsert({
                      payment_id: paymentId,
                      email: customerEmail,
                      password: "123456", // Sempre usar senha padrão
                      redirect_url: customer.metadata.redirectUrl,
                      created_at: new Date().toISOString()
                    });
                    
                  if (insertError) {
                    console.error(`[ERROR] Erro ao salvar dados recuperados: ${insertError.message}`);
                  } else {
                    console.log(`[SUCCESS] Credenciais salvas na tabela payment_credentials para recuperação futura`);
                  }
                } catch (insertErr) {
                  console.error(`[ERROR] Erro ao salvar dados recuperados: ${insertErr.message}`);
                }
                
                return new Response(
                  JSON.stringify({
                    success: true,
                    data: {
                      email: customerEmail,
                      password: "123456", // Sempre retornar a senha padrão
                      redirect_url: customer.metadata.redirectUrl,
                      ...paymentData
                    },
                    source: 'stripe'
                  }),
                  {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                  }
                );
              } else {
                console.log(`[WARN] Dados incompletos nos metadados do cliente. Email: ${customerEmail ? 'Sim' : 'Não'}, Senha: ${password ? 'Sim' : 'Não'}`);
                
                // Se temos pelo menos o email, retorná-lo
                if (customerEmail) {
                  console.log(`[INFO] Retornando apenas email do cliente: ${customerEmail}`);
                  return new Response(
                    JSON.stringify({
                      success: true,
                      data: {
                        email: customerEmail,
                        ...paymentData
                      },
                      source: 'stripe_partial'
                    }),
                    {
                      status: 200,
                      headers: { ...corsHeaders, "Content-Type": "application/json" }
                    }
                  );
                }
              }
            } else {
              console.log(`[WARN] Cliente não tem metadados`);
              
              // Se temos pelo menos o email, retorná-lo
              if (customerEmail) {
                console.log(`[INFO] Retornando apenas email do cliente: ${customerEmail}`);
                return new Response(
                  JSON.stringify({
                    success: true,
                    data: {
                      email: customerEmail,
                      ...paymentData
                    },
                    source: 'stripe_email_only'
                  }),
                  {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                  }
                );
              }
            }
          } else {
            console.log(`[WARN] Cliente não encontrado ou excluído: ${customerIdToSearch}`);
          }
        } catch (customerErr) {
          console.error(`[ERROR] Erro ao recuperar cliente: ${customerErr.message}`);
        }
      } else {
        console.log(`[WARN] Não foi possível identificar o cliente associado ao pagamento ${paymentId}`);
      }
    } catch (stripeErr) {
      console.error(`[ERROR] Erro ao buscar no Stripe: ${stripeErr.message}`);
    }

    // Se chegamos aqui, não encontramos as credenciais completas
    console.log(`[WARN] Credenciais completas não encontradas para pagamento ${paymentId}`);
    
    // Se pelo menos temos uma sessão/pagamento, retornar o que temos
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Credenciais não encontradas",
        message: "Não foi possível recuperar os dados completos para este pagamento"
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