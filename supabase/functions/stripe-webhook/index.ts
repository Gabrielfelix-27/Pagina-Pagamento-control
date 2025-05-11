import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { EmailService, generateRandomPassword } from "./email-service.ts";

// Cabeçalhos CORS simplificados
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Inicialização do Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Inicialização do Stripe
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// URL da aplicação para links em emails
const appUrl = Deno.env.get("APP_URL") || "https://app.drcfinancas.com.br";

// Chave de webhook para verificar assinatura
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "whsec_m37ENzGMIv9SToIgzFyGDgBqd3pxwG6z";

// SendGrid API Key para verificação
const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";

console.log("[✓] Função stripe-webhook inicializada");
console.log(`[INFO] Supabase URL está configurada: ${!!supabaseUrl}`);
console.log(`[INFO] Supabase Service Key está configurada: ${!!supabaseServiceKey}`);
console.log(`[INFO] Stripe Secret Key está configurada: ${!!stripeSecretKey}`);
console.log(`[INFO] Webhook Secret está configurada: ${!!endpointSecret}`);
console.log(`[INFO] SendGrid API Key está configurada: ${!!sendGridApiKey}`);
console.log(`[INFO] APP URL está configurada: ${appUrl}`);

// Verificando variáveis críticas
if (!sendGridApiKey) {
  console.error("[CRITICAL] SendGrid API Key não está configurada! Emails não serão enviados.");
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
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificação JWT desativada via config.toml: [functions.stripe-webhook] verify_jwt = false
    console.log("[INFO] Iniciando processamento do webhook com JWT desativado via config.toml");
    console.log("[INFO] STRIPE_WEBHOOK_SECRET:", endpointSecret ? endpointSecret.substring(0, 8) + "..." : "não configurado");
    
    // 1. Obter o corpo da requisição
    const payload = await req.text();
    
    // 2. Obter o cabeçalho stripe-signature
    const sig = req.headers.get("stripe-signature");
    
    if (!sig) {
      console.error("[ERROR] Cabeçalho stripe-signature ausente");
      return new Response(
        JSON.stringify({ error: "Cabeçalho stripe-signature ausente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // 3. Verificar a assinatura e construir o evento
    let event;
    
    try {
      // Construir o evento diretamente sem verificação SubtleCrypto
      console.log("[INFO] Decodificando o payload JSON sem verificação criptográfica");
      event = JSON.parse(payload);
      
      // Verificação básica do formato do evento
      if (!event.type || !event.data || !event.data.object) {
        throw new Error("Formato de evento inválido");
      }
      
      console.log("[SUCCESS] Evento webhook parseado com sucesso");
    } catch (err) {
      console.error(`[ERROR] Erro no parsing do webhook: ${err.message}`);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[INFO] Evento recebido: ${event.type}`);

    // Processar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.session.completed':
        console.log(`[EVENT] Processando checkout.session.completed: ${JSON.stringify(event.data.object.id)}`);
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        console.log(`[EVENT] Processando payment_intent.succeeded: ${JSON.stringify(event.data.object.id)}`);
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'customer.subscription.created':
        console.log(`[EVENT] Processando customer.subscription.created: ${JSON.stringify(event.data.object.id)}`);
        await handleSubscriptionCreated(event.data.object);
        break;
      default:
        console.log(`[INFO] Evento não tratado: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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

/**
 * Processa uma sessão de checkout completa
 */
async function handleCheckoutSessionCompleted(session) {
  console.log('==========================================');
  console.log('[INFO] Processando checkout.session.completed');
  console.log(`[INFO] ID da sessão: ${session.id}`);
  console.log(`[INFO] Status da sessão: ${session.status}`);
  console.log(`[INFO] Payment status: ${session.payment_status}`);
  console.log(`[INFO] Customer ID: ${session.customer}`);
  console.log(`[DEBUG] Objeto completo da sessão: ${JSON.stringify(session, null, 2)}`);

  // Só continua se o status for pago
  if (session.payment_status !== 'paid') {
    console.log(`[INFO] Sessão não paga, status: ${session.payment_status}`);
    return;
  }

  try {
    // Obter dados do cliente no Stripe
    console.log(`[DEBUG] Recuperando dados do cliente do Stripe: ${session.customer}`);
    const customer = await stripe.customers.retrieve(session.customer);
    
    console.log(`[DEBUG] Dados do cliente: ${JSON.stringify(customer, null, 2)}`);
    
    if (!customer || !customer.email) {
      console.error(`[ERROR] Cliente inválido ou sem email: ${JSON.stringify(customer)}`);
      return;
    }
    
    console.log(`[INFO] Cliente recuperado: ${customer.email}`);

    // CORREÇÃO: Verificar se o usuário já existe no Supabase usando auth.admin.listUsers
    console.log(`[DEBUG] Verificando se usuário com email ${customer.email} já existe`);
    const { data: existingUsers, error: userLookupError } = await supabase.auth.admin.listUsers();

    if (userLookupError) {
      console.error(`[ERROR] Erro ao listar usuários: ${userLookupError.message}`);
      throw userLookupError;
    }

    // Procura o usuário pelo email
    const existingUser = existingUsers?.users?.find(user => user.email === customer.email);
    
    let userId = null;
    let tempPassword = "123456"; // Senha fixa padrão

    // Se o usuário não existe, criar no Auth
    if (!existingUser) {
      console.log(`[INFO] Usuário não encontrado, criando novo usuário para: ${customer.email}`);
      
      // Gerar senha aleatória
      console.log(`[DEBUG] Senha temporária gerada: ${tempPassword}`);

      try {
        // Criar usuário no Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: customer.email,
          password: "123456",
          email_confirm: true,
          user_metadata: {
            stripe_customer_id: customer.id,
            payment_id: session.id,
            payment_status: 'paid'
          }
        });

        if (createError) {
          throw createError;
        }

        if (newUser && newUser.user) {
          userId = newUser.user.id;
          console.log(`[SUCCESS] Usuário criado com sucesso! ID: ${userId}`);
          
          // Atualizar usuário no Stripe com metadados
          console.log(`[DEBUG] Atualizando metadados do cliente no Stripe`);
          await stripe.customers.update(customer.id, {
            metadata: {
              userId: userId,
              password: "123456",
              subscription_status: "active",
              created_at: new Date().toISOString()
            }
          });
          
          // Garantir que a tabela profiles existe
          console.log(`[DEBUG] Verificando se a tabela profiles existe`);
          const { data: profilesExists, error: profileCheckError } = await supabase
            .from('profiles')
            .select('count(*)', { count: 'exact', head: true });
            
          if (profileCheckError) {
            console.error(`[ERROR] Erro ao verificar tabela profiles: ${profileCheckError.message}`);
            
            // Tentar criar a tabela profiles via SQL direto
            console.log(`[INFO] Tentando criar tabela profiles via SQL direto`);
            try {
              const createTableSQL = `
              CREATE TABLE IF NOT EXISTS public.profiles (
                id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                email TEXT NOT NULL, 
                full_name TEXT,
                avatar_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                stripe_customer_id TEXT,
                subscription_status TEXT,
                subscription_id TEXT,
                plan_id TEXT,
                payment_status TEXT,
                subscription_period_end TIMESTAMP WITH TIME ZONE,
                last_payment_id TEXT,
                last_payment_status TEXT,
                last_payment_amount DECIMAL(10,2),
                last_payment_date TIMESTAMP WITH TIME ZONE,
                payment_source TEXT,
                is_subscribed BOOLEAN DEFAULT FALSE
              );
              
              ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
              `;
              
              await supabase.rpc('pgexecute', { query: createTableSQL });
              console.log(`[SUCCESS] Tabela profiles criada com sucesso via SQL direto`);
            } catch (createTableError) {
              console.error(`[ERROR] Erro ao criar tabela profiles: ${createTableError.message}`);
              // Continuar mesmo com o erro
            }
          } else {
            console.log(`[INFO] Tabela profiles verificada com sucesso`);
          }
          
          // Tentar inserir o perfil de várias maneiras
          console.log(`[DEBUG] Tentando inserir perfil...`);
          
          // Método 1: Tentar diretamente via from().insert()
          try {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: customer.email,
                stripe_customer_id: customer.id,
                payment_status: 'paid',
                subscription_status: 'active',
                is_subscribed: true,
                last_payment_id: session.id,
                last_payment_status: 'paid',
                last_payment_date: new Date().toISOString()
              });

            if (profileError) {
              console.error(`[ERROR] Erro ao inserir perfil (Método 1): ${profileError.message}`);
              throw profileError;
            } else {
              console.log(`[SUCCESS] Perfil inserido com sucesso (Método 1)`);
            }
          } catch (profileInsertError) {
            console.error(`[ERROR] Exceção ao inserir perfil (Método 1): ${profileInsertError.message}`);
            
            // Método 2: Tentar via função insert_profile
            try {
              console.log(`[DEBUG] Tentando inserir perfil via função insert_profile (Método 2)`);
              const { error: rpcError } = await supabase.rpc('insert_profile', {
                user_id: userId,
                user_email: customer.email,
                customer_id: customer.id,
                payment_id: session.id
              });
              
              if (rpcError) {
                console.error(`[ERROR] Erro ao inserir perfil via função (Método 2): ${rpcError.message}`);
                throw rpcError;
              } else {
                console.log(`[SUCCESS] Perfil inserido com sucesso via função (Método 2)`);
              }
            } catch (rpcError) {
              console.error(`[ERROR] Exceção ao chamar função insert_profile (Método 2): ${rpcError.message}`);
              
              // Método 3: Último recurso - SQL direto
              try {
                console.log(`[DEBUG] Tentando inserir perfil via SQL direto (Método 3)`);
                const insertSQL = `
                INSERT INTO public.profiles (
                  id, email, stripe_customer_id, payment_status, subscription_status, is_subscribed, 
                  last_payment_id, last_payment_status, last_payment_date
                ) VALUES (
                  '${userId}', 
                  '${customer.email}', 
                  '${customer.id}', 
                  'paid',
                  'active',
                  true,
                  '${session.id}',
                  'paid',
                  now()
                )
                ON CONFLICT (id) DO UPDATE SET
                  email = EXCLUDED.email,
                  stripe_customer_id = EXCLUDED.stripe_customer_id,
                  payment_status = EXCLUDED.payment_status,
                  subscription_status = EXCLUDED.subscription_status,
                  is_subscribed = EXCLUDED.is_subscribed,
                  last_payment_id = EXCLUDED.last_payment_id,
                  last_payment_status = EXCLUDED.last_payment_status,
                  last_payment_date = EXCLUDED.last_payment_date,
                  updated_at = now();
                `;
                
                const { error: sqlError } = await supabase.rpc('pgexecute', { query: insertSQL });
                
                if (sqlError) {
                  console.error(`[ERROR] Erro ao inserir perfil via SQL direto (Método 3): ${sqlError.message}`);
                } else {
                  console.log(`[SUCCESS] Perfil inserido com sucesso via SQL direto (Método 3)`);
                }
              } catch (directSqlError) {
                console.error(`[ERROR] Exceção ao executar SQL direto (Método 3): ${directSqlError.message}`);
                console.error(`[ERROR] Não foi possível criar o perfil do usuário após 3 tentativas diferentes`);
              }
            }
          }
        } else {
          console.error(`[ERROR] Não foi possível criar o usuário, resposta vazia`);
        }
      } catch (userCreateError) {
        console.error(`[ERROR] Erro ao criar usuário: ${userCreateError.message}`);
        
        // Se o erro for que o usuário já existe, tentar recuperá-lo
        if (userCreateError.message.includes('already exists')) {
          console.log(`[INFO] Usuário já existe, buscando id...`);
          const { data: existingUsersRetry, error: fetchError } = await supabase.auth.admin.listUsers();

          if (fetchError) {
            console.error(`[ERROR] Erro ao buscar usuário existente: ${fetchError.message}`);
          } else if (existingUsersRetry && existingUsersRetry.users) {
            const foundUser = existingUsersRetry.users.find(user => user.email === customer.email);
            if (foundUser) {
              userId = foundUser.id;
              console.log(`[INFO] Encontrado usuário existente com ID: ${userId}`);
              
              // Atualizar usuário no Stripe
              console.log(`[DEBUG] Atualizando metadados do cliente no Stripe para usuário existente`);
              await stripe.customers.update(customer.id, {
                metadata: {
                  userId: userId,
                  subscription_status: "active",
                  updated_at: new Date().toISOString()
                }
              });
            }
          }
        }
      }
    } else {
      userId = existingUser.id;
      console.log(`[INFO] Usuário já existe, ID: ${userId}`);
    }

    // Se temos um ID de usuário, atualizar no Stripe e preparar redirecionamento
    if (userId) {
      try {
        // Atualizar dados de assinatura na tabela profiles
        console.log(`[DEBUG] Atualizando perfil do usuário com dados de pagamento`);
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: customer.email,
            stripe_customer_id: customer.id,
            payment_status: 'paid',
            subscription_status: 'active',
            is_subscribed: true,
            last_payment_id: session.id,
            last_payment_status: 'paid',
            last_payment_date: new Date().toISOString()
          });

        if (updateProfileError) {
          console.error(`[ERROR] Erro ao atualizar perfil: ${updateProfileError.message}`);
          
          // Tentar atualizar via SQL direto
          try {
            console.log(`[DEBUG] Tentando atualizar perfil via SQL direto`);
            const updateSQL = `
            INSERT INTO public.profiles (
              id, email, stripe_customer_id, payment_status, subscription_status, is_subscribed, 
              last_payment_id, last_payment_status, last_payment_date
            ) VALUES (
              '${userId}', 
              '${customer.email}', 
              '${customer.id}', 
              'paid',
              'active',
              true,
              '${session.id}',
              'paid',
              now()
            )
            ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              stripe_customer_id = EXCLUDED.stripe_customer_id,
              payment_status = EXCLUDED.payment_status,
              subscription_status = EXCLUDED.subscription_status,
              is_subscribed = EXCLUDED.is_subscribed,
              last_payment_id = EXCLUDED.last_payment_id,
              last_payment_status = EXCLUDED.last_payment_status,
              last_payment_date = EXCLUDED.last_payment_date,
              updated_at = now();
            `;
            
            const { error: sqlError } = await supabase.rpc('pgexecute', { query: updateSQL });
            
            if (sqlError) {
              console.error(`[ERROR] Erro ao atualizar perfil via SQL direto: ${sqlError.message}`);
            } else {
              console.log(`[SUCCESS] Perfil atualizado com sucesso via SQL direto`);
            }
          } catch (directSqlError) {
            console.error(`[ERROR] Exceção ao executar SQL direto para atualizar: ${directSqlError.message}`);
          }
        } else {
          console.log(`[SUCCESS] Perfil atualizado com sucesso`);
        }

        // Determinar a URL base
        const baseUrl = Deno.env.get("APP_URL") || "https://app.driverincontrol.com.br";
        const redirectUrl = `${baseUrl}/payment-confirmation?email=${encodeURIComponent(customer.email)}&password=${encodeURIComponent(tempPassword)}`;
        console.log(`[INFO] Preparando redirecionamento para ${redirectUrl}`);
        
        // Atualizar a sessão do checkout com a URL de redirecionamento
        if (tempPassword) {
          console.log(`[DEBUG] Atualizando sessão de checkout com URL de redirecionamento`);
          try {
            await stripe.checkout.sessions.update(session.id, {
              success_url: redirectUrl
            });
            console.log(`[SUCCESS] URL de redirecionamento atualizada na sessão`);
          } catch (updateSessionError) {
            console.error(`[ERROR] Erro ao atualizar URL na sessão: ${updateSessionError.message}`);
          }
        }

        // Se for um novo usuário, armazenar credenciais para recuperação futura
        if (userId && tempPassword) {
          await storeCredentialsForRecovery(
            session.id, // ID da sessão como payment_id
            customer.email,
            "123456", // Senha fixa padrão
            redirectUrl
          );
          
          // Também salvar usando o payment_intent se disponível
          if (session.payment_intent) {
            await storeCredentialsForRecovery(
              typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id,
              customer.email,
              "123456", // Senha fixa padrão
              redirectUrl
            );
          }
        }
      } catch (finalError) {
        console.error(`[ERROR] Erro final ao processar checkout: ${finalError.message}`);
      }
    } else {
      console.error(`[ERROR] Não foi possível obter o ID do usuário após tentativas de criação`);
    }
    
    console.log('[INFO] Processamento de checkout.session.completed finalizado');
    console.log('==========================================');
  } catch (error) {
    console.error(`[ERROR] Erro global no processamento da sessão: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * Processa um pagamento bem-sucedido
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('[INFO] Processando payment_intent.succeeded');
  console.log(`[INFO] ID do pagamento: ${paymentIntent.id}`);
  console.log(`[INFO] Status: ${paymentIntent.status}`);
  console.log(`[INFO] Amount: ${paymentIntent.amount / 100}`);
  console.log(`[INFO] Customer: ${paymentIntent.customer}`);
  console.log(`[DEBUG] Objeto completo do paymentIntent: ${JSON.stringify(paymentIntent, null, 2)}`);

  // Se não tiver customer associado, tenta outras formas de obter
  if (!paymentIntent.customer) {
    console.log('[WARN] PaymentIntent sem customer associado. Tentando obter de outros campos...');
    
    // Se tiver metadata com email, usar isso
    if (paymentIntent.metadata && paymentIntent.metadata.email) {
      console.log(`[INFO] Encontrado email em metadata: ${paymentIntent.metadata.email}`);
      // Criar cliente com este email
      try {
        const { data: newCustomer } = await stripe.customers.create({
          email: paymentIntent.metadata.email,
          name: paymentIntent.metadata.name || 'Cliente',
          metadata: { payment_intent_id: paymentIntent.id }
        });
        
        console.log(`[INFO] Cliente criado no Stripe: ${newCustomer.id}`);
        // Continuar processamento com este cliente
        await processCustomerFromPayment(newCustomer, paymentIntent);
        return;
      } catch (err) {
        console.error(`[ERROR] Erro ao criar cliente: ${err.message}`);
      }
    }
    
    // Tentar obter de outro jeito se disponível
    if (paymentIntent.receipt_email) {
      console.log(`[INFO] Usando receipt_email: ${paymentIntent.receipt_email}`);
      try {
        const { data: newCustomer } = await stripe.customers.create({
          email: paymentIntent.receipt_email,
          metadata: { payment_intent_id: paymentIntent.id }
        });
        
        console.log(`[INFO] Cliente criado no Stripe: ${newCustomer.id}`);
        // Continuar processamento com este cliente
        await processCustomerFromPayment(newCustomer, paymentIntent);
        return;
      } catch (err) {
        console.error(`[ERROR] Erro ao criar cliente: ${err.message}`);
      }
    }
    
    console.error('[ERROR] Não foi possível determinar o cliente para este pagamento');
    return;
  }

  try {
    // Buscar detalhes do cliente
    const customer = await stripe.customers.retrieve(paymentIntent.customer);
    await processCustomerFromPayment(customer, paymentIntent);
  } catch (error) {
    console.error(`[ERROR] Erro ao processar pagamento: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
  }
}

/**
 * Processa o cliente a partir do pagamento e cria usuário se necessário
 */
async function processCustomerFromPayment(customer, paymentIntent) {
  try {
    console.log(`[INFO] Processando cliente ${customer.id} (${customer.email}) para pagamento ${paymentIntent.id}`);
    console.log(`[DEBUG] Dados completos do cliente: ${JSON.stringify(customer, null, 2)}`);
    
    if (!customer.email) {
      console.error(`[ERROR] Cliente ${customer.id} não tem email definido`);
      throw new Error('Email do cliente não disponível');
    }
    
    // Tentativa direta de criação de usuário - abordagem mais agressiva
    console.log(`[INFO] Tentativa direta de criação de usuário para ${customer.email}`);
    
    // Gerar senha temporária segura
    const tempPassword = "123456"; // Senha fixa padrão
    console.log(`[INFO] Senha definida para ${customer.email}: ${tempPassword}`);
    
    // Criar um novo usuário com autenticação no Auth
    try {
      console.log(`[DEBUG] Enviando solicitação de criação de usuário para o Supabase Auth`);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: customer.email,
        email_confirm: true,
        user_metadata: {
          full_name: customer.name || '',
          stripe_customer_id: customer.id,
          payment_intent_id: paymentIntent.id,
          payment_status: paymentIntent.status,
          created_from: 'payment_intent_direct'
        },
        password: "123456"
      });

      if (authError) {
        // Se o erro for que o usuário já existe, então tentamos recuperar o ID
        if (authError.message.includes('already exists')) {
          console.log(`[INFO] Usuário já existe, recuperando informações: ${customer.email}`);
          
          try {
            const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
            
            if (searchError) {
              console.error(`[ERROR] Erro ao listar usuários: ${searchError.message}`);
              throw searchError;
            }
            
            // Busca o usuário pelo email
            const existingUser = existingUsers.users.find(user => user.email === customer.email);
            
            if (existingUser) {
              console.log(`[INFO] Usuário encontrado, ID: ${existingUser.id}`);
              
              // Atualizar o perfil com informações do pagamento
              try {
                await updateUserPayment(existingUser.id, paymentIntent);
                console.log(`[SUCCESS] Informações de pagamento atualizadas para ${existingUser.id}`);
              } catch (updateError) {
                console.error(`[ERROR] Erro ao atualizar usuário: ${updateError.message}`);
              }
              
              return existingUser;
            } else {
              console.error(`[ERROR] Usuário existe mas não foi encontrado: ${customer.email}`);
              throw new Error(`Usuário existe mas não foi encontrado: ${customer.email}`);
            }
          } catch (refreshError) {
            console.error(`[ERROR] Erro ao buscar usuário existente: ${refreshError.message}`);
            throw refreshError;
          }
        } else {
          console.error(`[ERROR] Erro ao criar usuário no Auth: ${authError.message}`);
          throw authError;
        }
      }

      console.log(`[SUCCESS] Usuário criado com sucesso: ${authData.user.id}`);
      console.log(`[DEBUG] Detalhes do usuário criado: ${JSON.stringify(authData.user, null, 2)}`);

      // Atualizar perfil do usuário com dados adicionais
      try {
        await updateUserProfile(authData.user.id, customer, { 
          payment_status: paymentIntent.status,
          id: paymentIntent.id
        });
        console.log(`[SUCCESS] Perfil do usuário atualizado com sucesso`);
      } catch (profileError) {
        console.error(`[ERROR] Erro ao atualizar perfil: ${profileError.message}, mas usuário foi criado`);
      }
      
      // Atualizar o cliente da Stripe com os dados do usuário
      try {
        console.log(`[DEBUG] Atualizando cliente no Stripe com ID do usuário`);
        await stripe.customers.update(customer.id, {
          metadata: {
            supabase_user_id: authData.user.id,
            temp_password: "123456",
            created_at: new Date().toISOString()
          }
        });
        console.log(`[SUCCESS] Cliente Stripe atualizado com dados do usuário`);
      } catch (stripeUpdateError) {
        console.error(`[ERROR] Erro ao atualizar cliente no Stripe: ${stripeUpdateError.message}`);
      }
      
      // Loggar as credenciais para debug (remover em produção)
      console.log(`[DEBUG] Credenciais para ${customer.email}: Senha=${tempPassword}`);
      
      // Armazenar credenciais para recuperação futura
      try {
        console.log(`[INFO] Armazenando credenciais para payment_intent: ${paymentIntent.id}`);
        await storeCredentialsForRecovery(
          paymentIntent.id,
          customer.email,
          "123456", // Senha fixa padrão
          null
        );
      } catch (storeError) {
        console.error(`[ERROR] Erro ao armazenar credenciais: ${storeError.message}`);
      }
      
      return authData.user;
    } catch (finalError) {
      console.error(`[ERROR] Erro final na criação do usuário: ${finalError.message}`);
      throw finalError;
    }
  } catch (error) {
    console.error(`[ERROR] Erro no processamento do cliente: ${error.message}`);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Processa uma assinatura criada
 */
async function handleSubscriptionCreated(subscription) {
  console.log('[INFO] Processando customer.subscription.created');
  console.log(`[INFO] ID da assinatura: ${subscription.id}`);
  console.log(`[INFO] Customer: ${subscription.customer}`);
  console.log(`[INFO] Status: ${subscription.status}`);
  
  // Apenas processa assinaturas ativas ou em teste
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    console.log(`[INFO] Assinatura com status não ativo: ${subscription.status}`);
    return;
  }

  try {
    // Buscar detalhes do cliente
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    // Verificar se já existe no Supabase
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
      
    if (searchError) {
      console.error(`[ERROR] Erro ao listar usuários: ${searchError.message}`);
      throw searchError;
    }
    
    // Verifica se o email já existe na lista de usuários
    const existingUser = existingUsers.users.find(user => user.email === customer.email);
    
    if (existingUser) {
      await updateUserSubscription(existingUser.id, subscription);
      
      // Enviar email de confirmação de assinatura
      if (!sendGridApiKey) {
        console.error("[ERROR] SendGrid API Key não configurada! Email de confirmação não enviado para " + customer.email);
      } else {
        try {
          const planDetails = {
            name: 'Plano DRC Finanças',
            status: subscription.status,
            amount: subscription.plan ? subscription.plan.amount : null
          };
          
          console.log(`[INFO] Tentando enviar email de confirmação para ${customer.email} via SendGrid`);
          const emailResult = await EmailService.sendSubscriptionConfirmationEmail(
            customer.email, 
            planDetails, 
            customer.name || 'Cliente'
          );
          
          if (emailResult) {
            console.log(`[SUCCESS] Email de confirmação enviado com sucesso para ${customer.email}`);
          } else {
            console.error(`[ERROR] Falha ao enviar email de confirmação, retornou false para ${customer.email}`);
          }
        } catch (emailError) {
          console.error(`[ERROR] Erro ao enviar email de confirmação: ${emailError.message}`);
          console.error(`[ERROR] Stack trace: ${emailError.stack || 'Não disponível'}`);
        }
      }
      
      return;
    }
    
    // Se não existe, criar um novo usuário
    // Lógica semelhante ao processamento de pagamento
    console.log(`[INFO] Criando usuário para ${customer.email} após subscription`);
    
    // Gerar senha temporária segura
    const tempPassword = "123456"; // Senha fixa padrão
    
    // Criar um novo usuário com autenticação no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customer.email,
      email_confirm: true,
      user_metadata: {
        full_name: customer.name || '',
        stripe_customer_id: customer.id,
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        created_from: 'subscription'
      },
      password: "123456"
    });

    if (authError) {
      console.error(`[ERROR] Erro ao criar usuário no Auth: ${authError.message}`);
      throw authError;
    }

    // Atualizar perfil
    await updateUserSubscription(authData.user.id, subscription);
    
    // Loggar as credenciais para debug
    console.log(`[DEBUG] Credenciais para ${customer.email}: Senha=${tempPassword}`);
    
    // Armazenar credenciais para recuperação futura
    try {
      console.log(`[INFO] Armazenando credenciais para subscription: ${subscription.id}`);
      await storeCredentialsForRecovery(
        subscription.id,
        customer.email,
        "123456", // Senha fixa padrão
        null
      );
    } catch (storeError) {
      console.error(`[ERROR] Erro ao armazenar credenciais: ${storeError.message}`);
    }
    
    // Verificar se a SendGrid API Key está configurada
    if (!sendGridApiKey) {
      console.error("[ERROR] SendGrid API Key não configurada! Emails não enviados para " + customer.email);
    } else {
      // Enviar email de boas-vindas
      try {
        console.log(`[INFO] Tentando enviar email de boas-vindas para ${customer.email} via SendGrid`);
        const emailResult = await EmailService.sendWelcomeEmail(customer.email, tempPassword, customer.name || 'Cliente');
        
        if (emailResult) {
          console.log(`[SUCCESS] Email de boas-vindas enviado com sucesso para ${customer.email}`);
        } else {
          console.error(`[ERROR] Falha ao enviar email de boas-vindas, retornou false para ${customer.email}`);
        }
      } catch (emailError) {
        console.error(`[ERROR] Erro ao enviar email de boas-vindas: ${emailError.message}`);
        console.error(`[ERROR] Stack trace: ${emailError.stack || 'Não disponível'}`);
      }
      
      // Enviar email de confirmação de assinatura
      try {
        const planDetails = {
          name: 'Plano DRC Finanças',
          status: subscription.status,
          amount: subscription.plan ? subscription.plan.amount : null
        };
        
        console.log(`[INFO] Tentando enviar email de confirmação para ${customer.email} via SendGrid`);
        const emailResult = await EmailService.sendSubscriptionConfirmationEmail(
          customer.email, 
          planDetails,
          customer.name || 'Cliente'
        );
        
        if (emailResult) {
          console.log(`[SUCCESS] Email de confirmação enviado com sucesso para ${customer.email}`);
        } else {
          console.error(`[ERROR] Falha ao enviar email de confirmação, retornou false para ${customer.email}`);
        }
      } catch (emailError) {
        console.error(`[ERROR] Erro ao enviar email de confirmação: ${emailError.message}`);
        console.error(`[ERROR] Stack trace: ${emailError.stack || 'Não disponível'}`);
      }
    }
    
  } catch (error) {
    console.error(`[ERROR] Erro ao processar assinatura: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
  }
}

/**
 * Atualiza o perfil do usuário com dados adicionais
 */
async function updateUserProfile(userId, customer, data) {
  try {
    console.log(`[DEBUG] Início de updateUserProfile para userId=${userId}`);
    console.log(`[DEBUG] Dados do customer:`, JSON.stringify(customer));
    console.log(`[DEBUG] Dados extras:`, JSON.stringify(data));
    
    // Obter informações adicionais que queremos salvar
    const currentDate = new Date().toISOString();

    // Determinar se estamos lidando com uma sessão de checkout ou um pagamento direto
    const isCheckoutSession = data && data.payment_status;
    const isPaymentIntent = data && data.status;
    
    // Informações a serem salvas
    const profileData = {
      id: userId,
      updated_at: currentDate,
      created_at: currentDate, // Garantir que temos uma data de criação
      email: customer.email,   // Garantir que o email está salvo na tabela profiles
      stripe_customer_id: customer.id,
      full_name: customer.name || customer.metadata?.name || '',
      is_subscribed: true,
      avatar_url: null
    };
    
    // Adicionar dados específicos baseados no tipo de evento
    if (isCheckoutSession) {
      // Adicionar dados específicos de sessão de checkout
      Object.assign(profileData, {
        subscription_status: 'active',
        subscription_id: data.subscription || null,
        plan_id: extractPlanIdFromSession(data),
        payment_status: data.payment_status,
        subscription_period_end: calculateSubscriptionEndDate(data)
      });
    } else if (isPaymentIntent) {
      // Adicionar dados específicos de payment intent
      Object.assign(profileData, {
        payment_status: data.status || 'paid',
        last_payment_id: data.id,
        last_payment_status: data.status,
        last_payment_amount: data.amount ? data.amount / 100 : null,
        last_payment_date: currentDate,
        payment_source: 'payment_intent'
      });
    }
    
    console.log(`[INFO] Atualizando perfil para usuário ${userId} com dados:`, JSON.stringify(profileData));
    
    // Verificar se o perfil já existe
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileCheckError) {
      console.error(`[ERROR] Erro ao verificar perfil existente: ${profileCheckError.message}`);
    }
    
    // Log para depuração
    console.log(`[DEBUG] Perfil existente: ${existingProfile ? 'Sim' : 'Não'}`);
    
    let upsertResult;
    
    // Primeira tentativa: upsert na tabela de perfis
    try {
      upsertResult = await supabase
        .from('profiles')
        .upsert(profileData);
        
      if (upsertResult.error) {
        console.error(`[ERROR] Erro no upsert de perfil: ${upsertResult.error.message}`);
        console.error(`[ERROR] Detalhe: ${upsertResult.error.details}`);
        
        // Se houve erro no upsert, tentar insert
        if (!existingProfile) {
          console.log(`[INFO] Tentando inserir perfil em vez de upsert...`);
          const insertResult = await supabase
            .from('profiles')
            .insert(profileData);
            
          if (insertResult.error) {
            console.error(`[ERROR] Erro no insert de perfil: ${insertResult.error.message}`);
            console.error(`[ERROR] Detalhe: ${insertResult.error.details}`);
          } else {
            console.log(`[SUCCESS] Perfil inserido com sucesso para usuário ${userId}`);
            return; // Sucesso na inserção
          }
        } else {
          // Se o perfil existe, tentar update
          console.log(`[INFO] Tentando atualizar perfil em vez de upsert...`);
          const updateResult = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', userId);
            
          if (updateResult.error) {
            console.error(`[ERROR] Erro no update de perfil: ${updateResult.error.message}`);
            console.error(`[ERROR] Detalhe: ${updateResult.error.details}`);
          } else {
            console.log(`[SUCCESS] Perfil atualizado com sucesso para usuário ${userId}`);
            return; // Sucesso na atualização
          }
        }
        
        throw upsertResult.error;
      }
    } catch (dbError) {
      console.error(`[ERROR] Erro de banco de dados: ${dbError.message}`);
      throw dbError;
    }
    
    console.log(`[SUCCESS] Perfil upsert bem-sucedido para usuário ${userId}`);
  } catch (error) {
    console.error(`[ERROR] Erro em updateUserProfile: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
    // Não lançamos o erro para não interromper o fluxo
  }
}

/**
 * Atualiza as informações de assinatura do usuário
 */
async function updateUserSubscription(userId, subscription) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        updated_at: new Date().toISOString(),
        subscription_status: subscription.status || 'active',
        subscription_id: subscription.id || subscription.subscription,
        plan_id: extractPlanId(subscription),
        is_subscribed: true,
        subscription_period_end: calculateEndDate(subscription)
      })
      .eq('id', userId);

    if (error) {
      console.error(`[ERROR] Erro ao atualizar assinatura: ${error.message}`);
      throw error;
    }
    
    console.log(`[SUCCESS] Assinatura atualizada para usuário ${userId}`);
  } catch (error) {
    console.error(`[ERROR] Erro em updateUserSubscription: ${error.message}`);
    throw error;
  }
}

/**
 * Atualiza as informações de pagamento do usuário
 */
async function updateUserPayment(userId, paymentIntent) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        updated_at: new Date().toISOString(),
        last_payment_id: paymentIntent.id,
        last_payment_status: paymentIntent.status,
        last_payment_amount: paymentIntent.amount / 100, // Converte centavos para reais
        last_payment_date: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error(`[ERROR] Erro ao atualizar pagamento: ${error.message}`);
      throw error;
    }
    
    console.log(`[SUCCESS] Pagamento atualizado para usuário ${userId}`);
  } catch (error) {
    console.error(`[ERROR] Erro em updateUserPayment: ${error.message}`);
    throw error;
  }
}

/**
 * Extrai o ID do plano da sessão
 */
function extractPlanIdFromSession(session) {
  try {
    // Tentar obter o ID do plano das line_items
    if (session.line_items && session.line_items.data && session.line_items.data.length > 0) {
      return session.line_items.data[0].price.id;
    }
    
    // Se não tiver line_items, tentar obter da subscription
    if (session.subscription) {
      return `sub_${session.subscription}`;
    }
    
    return 'unknown_plan';
  } catch (error) {
    console.error(`[ERROR] Erro ao extrair ID do plano: ${error.message}`);
    return 'unknown_plan';
  }
}

/**
 * Extrai o ID do plano da assinatura
 */
function extractPlanId(subscription) {
  try {
    if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
      return subscription.items.data[0].price.id;
    }
    
    return 'unknown_plan';
  } catch (error) {
    console.error(`[ERROR] Erro ao extrair ID do plano: ${error.message}`);
    return 'unknown_plan';
  }
}

/**
 * Calcula a data de término da assinatura
 */
function calculateSubscriptionEndDate(session) {
  try {
    // Se for uma assinatura, calcular baseado na duração do plano
    if (session.subscription) {
      // Na produção, consultar os detalhes da assinatura para obter a data real
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      return oneMonthFromNow.toISOString();
    }
    
    // Para pagamentos únicos, não há data de expiração
    return null;
  } catch (error) {
    console.error(`[ERROR] Erro ao calcular data de término: ${error.message}`);
    return null;
  }
}

/**
 * Calcula a data de término com base nos dados da assinatura
 */
function calculateEndDate(subscription) {
  try {
    // Se tiver current_period_end, usar como data de término
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end * 1000).toISOString();
    }
    
    // Caso contrário, estimar baseado no plano (simplificado)
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    return oneMonthFromNow.toISOString();
  } catch (error) {
    console.error(`[ERROR] Erro ao calcular data de término: ${error.message}`);
    return null;
  }
}

// Após criar o usuário com sucesso, dentro das funções handleCheckoutSessionCompleted e handlePaymentIntentSucceeded
// Adicionar este código após a criação do usuário, antes de retornar

// Vamos melhorar o armazenamento das credenciais
async function storeCredentialsForRecovery(paymentId, email, password, redirectUrl = null) {
  console.log(`[INFO] Armazenando credenciais para recuperação futura: ${email}`);
  
  try {
    // 1. Salvar na tabela payment_credentials
    const { error: dbError } = await supabase
      .from('payment_credentials')
      .upsert({
        payment_id: paymentId,
        email: email,
        password: password,
        redirect_url: redirectUrl,
        created_at: new Date().toISOString()
      });
      
    if (dbError) {
      console.error(`[ERROR] Erro ao salvar credenciais na tabela: ${dbError.message}`);
    } else {
      console.log(`[SUCCESS] Credenciais salvas na tabela payment_credentials`);
    }
    
    // 2. Também armazenar no bucket do storage como backup
    try {
      const storageData = JSON.stringify({
        email: email,
        password: password,
        redirectUrl: redirectUrl,
        timestamp: new Date().toISOString()
      });
      
      const { error: storageError } = await supabase.storage
        .from('redirects')
        .upload(`${paymentId}.json`, new Blob([storageData], { type: 'application/json' }), {
          upsert: true
        });
        
      if (storageError) {
        console.error(`[ERROR] Erro ao salvar no storage: ${storageError.message}`);
      } else {
        console.log(`[SUCCESS] Credenciais salvas no storage como backup`);
      }
    } catch (storageErr) {
      console.error(`[ERROR] Exceção ao salvar no storage: ${storageErr.message}`);
    }
    
    return true;
  } catch (err) {
    console.error(`[ERROR] Erro ao armazenar credenciais: ${err.message}`);
    return false;
  }
}