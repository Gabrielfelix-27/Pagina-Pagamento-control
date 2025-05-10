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
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

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

    // Obtém a assinatura do cabeçalho
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("[ERROR] Assinatura do webhook não encontrada");
      return new Response(
        JSON.stringify({ error: "Assinatura do webhook não encontrada" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obtém o corpo da requisição
    const reqBody = await req.text();

    // Verifica a assinatura e constrói o evento
    let event;
    try {
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(reqBody, signature, endpointSecret);
      } else {
        // Se não há segredo configurado, apenas parse o JSON (não seguro para produção)
        console.warn("[WARN] Webhook sem verificação de assinatura - não seguro para produção");
        event = JSON.parse(reqBody);
      }
    } catch (err) {
      console.error(`[ERROR] Webhook error: ${err.message}`);
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

  // Só continua se o status for pago
  if (session.payment_status !== 'paid') {
    console.log(`[INFO] Sessão não paga, status: ${session.payment_status}`);
    return;
  }

  try {
    // Obter dados do cliente no Stripe
    console.log(`[DEBUG] Recuperando dados do cliente do Stripe: ${session.customer}`);
    const customer = await stripe.customers.retrieve(session.customer);
    
    if (!customer || !customer.email) {
      console.error(`[ERROR] Cliente inválido ou sem email: ${JSON.stringify(customer)}`);
      return;
    }
    
    console.log(`[INFO] Cliente recuperado: ${customer.email}`);

    // Verificar se o usuário já existe no Supabase usando auth.admin.listUsers
    console.log(`[DEBUG] Verificando se usuário com email ${customer.email} já existe`);
    const { data: existingUsers, error: userLookupError } = await supabase.auth.admin.listUsers();

    if (userLookupError) {
      console.error(`[ERROR] Erro ao listar usuários: ${userLookupError.message}`);
      throw userLookupError;
    }

    // Procura o usuário pelo email
    const existingUser = existingUsers?.users?.find(user => user.email === customer.email);
    
    let userId = null;
    let tempPassword = '';
    let userCreated = false;

    // Se o usuário não existe, criar no Auth
    if (!existingUser) {
      console.log(`[INFO] Usuário não encontrado, criando novo usuário para: ${customer.email}`);
      
      // Gerar senha aleatória
      tempPassword = generateRandomPassword(12);
      console.log(`[DEBUG] Senha temporária gerada: ${tempPassword.substring(0, 3)}...`);

      try {
        // Criar usuário no Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: customer.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            stripe_customer_id: customer.id,
            payment_id: session.id,
            payment_status: 'paid'
          }
        });

        if (createError) {
          console.error(`[ERROR] Erro ao criar usuário: ${createError.message}`);
          
          // Se o erro indicar que o usuário já existe, tentar recuperar o ID
          if (createError.message.includes('already exists')) {
            console.log(`[INFO] Usuário já existe, tentando recuperar por email`);
            
            // Buscar novamente os usuários para ter certeza que temos os dados mais recentes
            const { data: refreshedUsers } = await supabase.auth.admin.listUsers();
            const userByEmail = refreshedUsers?.users?.find(user => user.email === customer.email);
            
            if (userByEmail) {
              userId = userByEmail.id;
              console.log(`[SUCCESS] Usuário encontrado por email: ${userId}`);
            } else {
              throw new Error(`Usuário não pôde ser criado ou recuperado: ${createError.message}`);
            }
          } else {
            throw createError;
          }
        } else if (newUser && newUser.user) {
          userId = newUser.user.id;
          userCreated = true;
          console.log(`[SUCCESS] Usuário criado com sucesso! ID: ${userId}`);
          
          // Atualizar usuário no Stripe com metadados
          console.log(`[DEBUG] Atualizando metadados do cliente no Stripe`);
          await stripe.customers.update(customer.id, {
            metadata: {
              userId: userId,
              password: tempPassword,
              subscription_status: "active",
              created_at: new Date().toISOString()
            }
          });
        } else {
          throw new Error('Resposta vazia ao criar usuário');
        }
      } catch (userCreateError) {
        console.error(`[ERROR] Erro no processo de criação de usuário: ${userCreateError.message}`);
        
        // Última tentativa: verificar se o usuário foi criado apesar do erro
        try {
          const { data: finalCheck } = await supabase.auth.admin.listUsers();
          const userAfterError = finalCheck?.users?.find(user => user.email === customer.email);
          
          if (userAfterError) {
            userId = userAfterError.id;
            console.log(`[RECOVERY] Recuperado ID do usuário após erro: ${userId}`);
          } else {
            console.error(`[CRITICAL] Falha definitiva ao criar usuário: ${userCreateError.message}`);
            throw userCreateError;
          }
        } catch (finalError) {
          console.error(`[CRITICAL] Falha na última verificação: ${finalError.message}`);
          throw finalError;
        }
      }
      
      // Verificar se o userId foi definido
      if (!userId) {
        throw new Error('Não foi possível obter ID de usuário após tentativas de criação');
      }
      
      // Criar perfil apenas se o usuário foi criado com sucesso
      if (userId) {
        // Garantir que a tabela profiles existe
        try {
          console.log(`[DEBUG] Criando/atualizando perfil para usuário: ${userId}`);
          
          // Método abrangente: tenta criar/atualizar o perfil de várias maneiras
          const methods = [
            // Método 1: insert direto
            async () => {
              const { error } = await supabase
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
              
              if (error) throw error;
              return true;
            },
            
            // Método 2: via função RPC
            async () => {
              const { error } = await supabase.rpc('insert_profile', {
                user_id: userId,
                user_email: customer.email,
                customer_id: customer.id,
                payment_id: session.id
              });
              
              if (error) throw error;
              return true;
            },
            
            // Método 3: SQL direto
            async () => {
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
              
              const { error } = await supabase.rpc('pgexecute', { query: insertSQL });
              if (error) throw error;
              return true;
            }
          ];
          
          // Tentar cada método até que um funcione
          let profileCreated = false;
          for (let i = 0; i < methods.length; i++) {
            try {
              await methods[i]();
              console.log(`[SUCCESS] Perfil criado/atualizado com sucesso (Método ${i+1})`);
              profileCreated = true;
              break;
            } catch (error) {
              console.error(`[ERROR] Falha no método ${i+1}: ${error.message}`);
              // Continuar tentando o próximo método
            }
          }
          
          if (!profileCreated) {
            console.error(`[WARNING] Não foi possível criar/atualizar perfil após ${methods.length} tentativas`);
          }
        } catch (profileError) {
          console.error(`[ERROR] Erro no processo de criação de perfil: ${profileError.message}`);
          // Não vamos falhar completamente aqui, continuamos para mandar email e retornar sucesso
        }
      }
      
      // Se o usuário foi criado agora, enviar email com credenciais
      if (userCreated && sendGridApiKey) {
        try {
          console.log(`[INFO] Enviando email de boas-vindas para ${customer.email}`);
          await EmailService.sendWelcomeEmail(
            customer.email, 
            tempPassword, 
            customer.name || 'Cliente'
          );
        } catch (emailError) {
          console.error(`[ERROR] Erro ao enviar email: ${emailError.message}`);
          // Não falhar por causa do email
        }
      }
    } else {
      // Usuário já existe
      userId = existingUser.id;
      console.log(`[INFO] Usuário já existe, ID: ${userId}`);
      
      // Atualizar dados de pagamento
      try {
        await updateUserPayment(userId, { id: session.id, status: 'paid' });
        console.log(`[SUCCESS] Dados de pagamento atualizados para usuário existente`);
      } catch (updateError) {
        console.error(`[ERROR] Erro ao atualizar dados de pagamento: ${updateError.message}`);
      }
    }

    // Se temos um ID de usuário, atualizar no Stripe e preparar redirecionamento
    if (userId) {
      try {
        // Determinar a URL base
        const baseUrl = Deno.env.get("APP_URL") || "https://app.driverincontrol.com.br";
        
        // Criando URLs com encoding adequado para parâmetros
        let redirectUrl = '';
        
        if (userCreated && tempPassword) {
          // Usuário novo - incluir senha na URL
          redirectUrl = `${baseUrl}/payment-confirmation?email=${encodeURIComponent(customer.email)}&password=${encodeURIComponent(tempPassword)}`;
          console.log(`[INFO] URL com senha: ${redirectUrl}`);
          
          // Armazenar as credenciais também no Stripe para recuperação
          await stripe.customers.update(customer.id, {
            metadata: {
              ...customer.metadata,
              userId: userId,
              tempPassword: tempPassword,
              redirectUrl: redirectUrl,
              created_at: new Date().toISOString()
            }
          });
          console.log(`[SUCCESS] Credenciais salvas no metadata do cliente Stripe`);
        } else {
          // Usuário existente - apenas email
          redirectUrl = `${baseUrl}/payment-confirmation?email=${encodeURIComponent(customer.email)}`;
          console.log(`[INFO] URL sem senha (usuário existente): ${redirectUrl}`);
        }
        
        console.log(`[INFO] Preparando redirecionamento para ${redirectUrl}`);
        
        // Atualizar a sessão do checkout com a URL de redirecionamento
        try {
          // Verificando estado atual da sessão
          const sessionDetails = await stripe.checkout.sessions.retrieve(session.id);
          console.log(`[DEBUG] Success URL atual: ${sessionDetails.success_url}`);
          
          // Atualizar success_url da sessão
          const updateResult = await stripe.checkout.sessions.update(session.id, {
            success_url: redirectUrl
          });
          
          if (updateResult && updateResult.success_url) {
            console.log(`[SUCCESS] URL de redirecionamento atualizada: ${updateResult.success_url}`);
          } else {
            console.log(`[WARN] Atualização da URL feita, mas não confirmada no resultado`);
            
            // Tentar método alternativo - criar um endpoint ativo com redirect permanente
            const {data: stripeSession} = await supabase.storage.from('redirects').upload(
              `${session.id}.json`,
              JSON.stringify({
                email: customer.email,
                password: tempPassword,
                redirectUrl: redirectUrl,
                timestamp: new Date().toISOString()
              }),
              {
                contentType: 'application/json',
                cacheControl: '3600'
              }
            );
            console.log(`[INFO] Dados de redirect salvos em storage: ${stripeSession?.path || 'falha ao salvar'}`);
          }
        } catch (updateSessionError) {
          console.error(`[ERROR] Erro ao atualizar URL na sessão: ${updateSessionError.message}`);
          
          // Tentar método alternativo para salvar as credenciais - usando tabela de recuperação 
          try {
            const { error: recoveryError } = await supabase
              .from('payment_credentials')
              .upsert({
                payment_id: session.id,
                email: customer.email,
                password: tempPassword || null,
                redirect_url: redirectUrl,
                created_at: new Date().toISOString()
              });
              
            if (recoveryError) {
              console.error(`[ERROR] Erro ao salvar dados para recuperação: ${recoveryError.message}`);
            } else {
              console.log(`[RECOVERY] Dados salvos em tabela de recuperação`);
            }
          } catch (recoveryInsertError) {
            console.error(`[ERROR] Exceção ao tentar recuperação: ${recoveryInsertError.message}`);
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
  console.log(`[INFO] Amount: ${paymentIntent.amount ? paymentIntent.amount / 100 : 'N/A'}`);
  console.log(`[INFO] Customer: ${paymentIntent.customer}`);
  
  // Se não tiver customer associado, tentar encontrar ou criar um
  if (!paymentIntent.customer) {
    console.log('[WARN] PaymentIntent sem customer associado. Tentando obter de outros campos...');
    
    let customerEmail = null;
    let customerName = null;
    
    // Extrair de metadata, se possível
    if (paymentIntent.metadata && paymentIntent.metadata.email) {
      customerEmail = paymentIntent.metadata.email;
      customerName = paymentIntent.metadata.name || null;
      console.log(`[INFO] Email encontrado em metadata: ${customerEmail}`);
    }
    
    // Tentar também extrair dos dados de envio
    if (!customerEmail && paymentIntent.shipping && paymentIntent.shipping.name) {
      customerName = paymentIntent.shipping.name;
      if (paymentIntent.shipping.email) {
        customerEmail = paymentIntent.shipping.email;
        console.log(`[INFO] Email encontrado em shipping: ${customerEmail}`);
      }
    }
    
    // Se não tiver email, não podemos fazer muito
    if (!customerEmail) {
      console.error('[ERROR] Não foi possível obter email do cliente. Pagamento sem usuário associado.');
      return;
    }
    
    // Verifique se o cliente já existe
    try {
      const { data: customers } = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });
      
      if (customers && customers.data && customers.data.length > 0) {
        // Usar cliente existente
        const existingCustomer = customers.data[0];
        console.log(`[INFO] Cliente já existe no Stripe: ${existingCustomer.id}`);
        
        // Atualizar o payment intent com este cliente
        await stripe.paymentIntents.update(paymentIntent.id, {
          customer: existingCustomer.id
        });
        
        // Atualizar o paymentIntent local também
        paymentIntent.customer = existingCustomer.id;
      } else {
        // Criar novo cliente no Stripe
        const newCustomer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || undefined,
          metadata: {
            source: 'payment_intent_auto_create',
            payment_intent_id: paymentIntent.id
          }
        });
        
        console.log(`[INFO] Novo cliente criado no Stripe: ${newCustomer.id}`);
        
        // Atualizar o payment intent com este cliente
        await stripe.paymentIntents.update(paymentIntent.id, {
          customer: newCustomer.id
        });
        
        // Atualizar o paymentIntent local também
        paymentIntent.customer = newCustomer.id;
      }
    } catch (customerError) {
      console.error(`[ERROR] Erro ao processar cliente: ${customerError.message}`);
    }
  }
  
  // Se mesmo assim não tiver customer após tentativas, não podemos continuar
  if (!paymentIntent.customer) {
    console.error('[ERROR] Não foi possível associar um cliente ao pagamento após tentativas.');
    return;
  }
  
  // Buscar informações do cliente
  let customer;
  try {
    customer = await stripe.customers.retrieve(paymentIntent.customer);
    console.log(`[INFO] Cliente recuperado: ${customer.id}, Email: ${customer.email || 'N/A'}`);
  } catch (customerError) {
    console.error(`[ERROR] Erro ao recuperar cliente ${paymentIntent.customer}: ${customerError.message}`);
    return;
  }
  
  // Verificar se temos o email do cliente
  if (!customer.email) {
    console.error('[ERROR] Cliente sem email. Não é possível criar conta.');
    return;
  }
  
  // Verificar se o usuário já existe no Supabase
  let userId = null;
  let userCreated = false;
  let tempPassword = null;
  
  try {
    console.log(`[INFO] Buscando usuário com email: ${customer.email}`);
    
    // Primeiro verificar se o usuário já existe
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
    
    if (searchError) {
      console.error(`[ERROR] Erro ao listar usuários: ${searchError.message}`);
      throw searchError;
    }
    
    // Verificar entre os usuários existentes
    const existingUser = existingUsers.users.find(user => 
      user.email && user.email.toLowerCase() === customer.email.toLowerCase()
    );
    
    if (!existingUser) {
      // Usuário não existe, criar
      console.log(`[INFO] Usuário não encontrado. Criando novo usuário...`);
      
      // Gerar senha aleatória
      tempPassword = generateRandomPassword(12);
      
      // Criar usuário no supabase
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: customer.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: customer.name || '',
          stripe_customer_id: customer.id,
          payment_intent_id: paymentIntent.id,
          source: 'stripe_webhook'
        }
      });
      
      if (createError) {
        console.error(`[ERROR] Erro ao criar usuário: ${createError.message}`);
        throw createError;
      }
      
      if (newUser && newUser.user) {
        userId = newUser.user.id;
        userCreated = true;
        console.log(`[SUCCESS] Usuário criado com ID: ${userId}`);
        
        // Armazenar informações no customer do Stripe para recuperação futura
        try {
          await stripe.customers.update(customer.id, {
            metadata: {
              userId: userId,
              tempPassword: tempPassword,
              createdAt: new Date().toISOString()
            }
          });
          console.log(`[INFO] Metadados salvos no cliente do Stripe`);
        } catch (updateError) {
          console.error(`[WARN] Não foi possível salvar metadados no Stripe: ${updateError.message}`);
        }
        
        // Verificar/criar tabela de perfis
        try {
          console.log(`[INFO] Garantindo que a tabela profiles existe...`);
          
          // Tentar chamar a função Edge que criamos
          const profilesCheck = await fetch(`${supabaseUrl}/functions/v1/ensure-profiles-table`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            }
          }).then(r => r.json()).catch(err => {
            console.error(`[WARN] Erro ao chamar ensure-profiles-table: ${err.message}`);
            return { success: false };
          });
          
          if (profilesCheck.success) {
            console.log(`[INFO] Tabela profiles verificada/criada com sucesso!`);
          } else {
            console.warn(`[WARN] Não foi possível verificar a tabela profiles via Edge Function.`);
          }
        } catch (tableCheckError) {
          console.error(`[ERROR] Erro ao verificar tabela profiles: ${tableCheckError.message}`);
        }
        
        // Inserir perfil do usuário usando a função que criamos
        try {
          const { data: profileInserted, error: profileError } = await supabase.rpc(
            'insert_profile',
            {
              user_id: userId,
              user_email: customer.email,
              customer_id: customer.id,
              payment_id: paymentIntent.id
            }
          );
          
          if (profileError) {
            console.error(`[ERROR] Erro ao inserir perfil: ${profileError.message}`);
            
            // Método alternativo: inserir diretamente na tabela
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: customer.email,
                full_name: customer.name || null,
                stripe_customer_id: customer.id,
                payment_status: 'paid',
                is_subscribed: true,
                last_payment_id: paymentIntent.id,
                last_payment_status: 'paid',
                last_payment_date: new Date().toISOString()
              });
              
            if (insertError) {
              console.error(`[ERROR] Erro também ao inserir diretamente: ${insertError.message}`);
            } else {
              console.log(`[INFO] Perfil inserido via insert direto`);
            }
          } else {
            console.log(`[SUCCESS] Perfil criado via RPC insert_profile`);
          }
        } catch (insertProfileError) {
          console.error(`[ERROR] Exceção ao tentar inserir perfil: ${insertProfileError.message}`);
        }
        
        // Enviar email de boas-vindas
        try {
          const emailService = new EmailService(customer.email, sendGridApiKey);
          const emailResult = await emailService.sendWelcomeEmail({
            name: customer.name || 'Cliente',
            email: customer.email,
            password: tempPassword,
            loginUrl: `${appUrl}/login`
          });
          
          if (emailResult.success) {
            console.log(`[SUCCESS] Email de boas-vindas enviado para ${customer.email}`);
          } else {
            console.error(`[ERROR] Falha ao enviar email: ${emailResult.message}`);
          }
        } catch (emailError) {
          console.error(`[ERROR] Exceção ao enviar email: ${emailError.message}`);
        }
      }
    } else {
      // Usuário já existe
      userId = existingUser.id;
      console.log(`[INFO] Usuário já existe, ID: ${userId}`);
      
      // Atualizar perfil com informações do pagamento
      try {
        // Tentar usar a função RPC
        const { data: profileUpdated, error: updateError } = await supabase.rpc(
          'insert_profile',
          {
            user_id: userId,
            user_email: customer.email,
            customer_id: customer.id,
            payment_id: paymentIntent.id
          }
        );
        
        if (updateError) {
          console.error(`[ERROR] Erro ao atualizar perfil via RPC: ${updateError.message}`);
          
          // Método alternativo: fazer update direto
          const { error: directUpdateError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              email: customer.email,
              stripe_customer_id: customer.id,
              payment_status: 'paid',
              is_subscribed: true,
              last_payment_id: paymentIntent.id,
              last_payment_status: 'paid',
              last_payment_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (directUpdateError) {
            console.error(`[ERROR] Erro também ao atualizar diretamente: ${directUpdateError.message}`);
          } else {
            console.log(`[INFO] Perfil atualizado via upsert direto`);
          }
        } else {
          console.log(`[SUCCESS] Perfil atualizado via RPC insert_profile`);
        }
      } catch (updateProfileError) {
        console.error(`[ERROR] Exceção ao atualizar perfil: ${updateProfileError.message}`);
      }
    }
  } catch (authError) {
    console.error(`[ERROR] Erro no processo de autenticação: ${authError.message}`);
  }
  
  // Se temos um ID de usuário, atualizar no Stripe e preparar redirecionamento
  if (userId) {
    try {
      // Determinar a URL base
      const baseUrl = Deno.env.get("APP_URL") || "https://app.driverincontrol.com.br";
      
      // Criando URLs com encoding adequado para parâmetros
      let redirectUrl = '';
      
      if (userCreated && tempPassword) {
        // Usuário novo - incluir senha na URL
        redirectUrl = `${baseUrl}/payment-confirmation?email=${encodeURIComponent(customer.email)}&password=${encodeURIComponent(tempPassword)}`;
        console.log(`[INFO] URL com senha: ${redirectUrl}`);
        
        // Armazenar as credenciais também no Stripe para recuperação
        await stripe.customers.update(customer.id, {
          metadata: {
            userId: userId,
            tempPassword: tempPassword,
            redirectUrl: redirectUrl
          }
        });
        
        // Armazenar em tabela de backup para recuperação
        try {
          const { error: credentialsError } = await supabase
            .from('payment_credentials')
            .upsert({
              payment_id: paymentIntent.id,
              email: customer.email,
              password: tempPassword,
              redirect_url: redirectUrl,
              created_at: new Date().toISOString()
            });
            
          if (credentialsError) {
            console.error(`[ERROR] Erro ao salvar credenciais de backup: ${credentialsError.message}`);
          } else {
            console.log(`[INFO] Credenciais de backup salvas com sucesso`);
          }
        } catch (backupError) {
          console.error(`[ERROR] Exceção ao salvar credenciais de backup: ${backupError.message}`);
        }
      } else {
        // Usuário existente - apenas email
        redirectUrl = `${baseUrl}/payment-confirmation?email=${encodeURIComponent(customer.email)}`;
        console.log(`[INFO] URL sem senha: ${redirectUrl}`);
      }
      
      // Se houver URL de retorno no pagamento, atualizar
      if (paymentIntent.metadata && paymentIntent.metadata.return_url) {
        try {
          await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
              return_url: redirectUrl,
              user_id: userId
            }
          });
          console.log(`[INFO] URL de retorno atualizada no PaymentIntent`);
        } catch (updateError) {
          console.error(`[ERROR] Erro ao atualizar URL de retorno: ${updateError.message}`);
        }
      }
    } catch (redirectError) {
      console.error(`[ERROR] Erro ao preparar redirecionamento: ${redirectError.message}`);
    }
  } else {
    console.error(`[ERROR] Nenhum usuário criado ou encontrado para o pagamento`);
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
    console.log(`[INFO] Assinatura com status não processável: ${subscription.status}`);
    return;
  }

  try {
    // Buscar detalhes do cliente
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    if (!customer || !customer.email) {
      console.error(`[ERROR] Cliente inválido ou sem email: ${JSON.stringify(customer)}`);
      return;
    }
    
    console.log(`[INFO] Processando assinatura para cliente ${customer.id} (${customer.email})`);
    
    // Verificar se o usuário já existe no Supabase
    console.log(`[DEBUG] Verificando se usuário com email ${customer.email} já existe`);
    const { data: existingUsers, error: userLookupError } = await supabase.auth.admin.listUsers();
      
    if (userLookupError) {
      console.error(`[ERROR] Erro ao listar usuários: ${userLookupError.message}`);
      throw userLookupError;
    }
    
    // Procura o usuário pelo email
    const existingUser = existingUsers?.users?.find(user => user.email === customer.email);
    
    let userId = null;
    let tempPassword = '';
    let userCreated = false;
    
    // Se o usuário não existe, criar um novo
    if (!existingUser) {
      console.log(`[INFO] Usuário não encontrado, criando novo usuário para: ${customer.email}`);
      
      // Gerar senha aleatória
      tempPassword = generateRandomPassword(12);
      console.log(`[DEBUG] Senha temporária gerada: ${tempPassword.substring(0, 3)}...`);
      
      try {
        // Criar usuário no Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: customer.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            stripe_customer_id: customer.id,
            subscription_id: subscription.id,
            subscription_status: subscription.status,
            full_name: customer.name || ''
          }
        });
        
        if (createError) {
          console.error(`[ERROR] Erro ao criar usuário: ${createError.message}`);
          
          // Se o erro indicar que o usuário já existe, tentar recuperar o ID
          if (createError.message.includes('already exists')) {
            console.log(`[INFO] Usuário já existe, tentando recuperar por email`);
            
            // Buscar novamente os usuários para ter certeza que temos os dados mais recentes
            const { data: refreshedUsers } = await supabase.auth.admin.listUsers();
            const userByEmail = refreshedUsers?.users?.find(
              user => user.email && user.email.toLowerCase() === customer.email.toLowerCase()
            );
            
            if (userByEmail) {
              userId = userByEmail.id;
              console.log(`[SUCCESS] Usuário encontrado por email: ${userId}`);
            } else {
              throw new Error(`Usuário não pôde ser criado ou recuperado: ${createError.message}`);
            }
          } else {
            throw createError;
          }
        } else if (newUser && newUser.user) {
          userId = newUser.user.id;
          userCreated = true;
          console.log(`[SUCCESS] Usuário criado com sucesso! ID: ${userId}`);
          
          // Atualizar usuário no Stripe com metadados
          console.log(`[DEBUG] Atualizando metadados do cliente no Stripe`);
          await stripe.customers.update(customer.id, {
            metadata: {
              userId: userId,
              password: tempPassword,
              subscription_status: subscription.status,
              created_at: new Date().toISOString()
            }
          });
        } else {
          throw new Error('Resposta vazia ao criar usuário');
        }
      } catch (userCreateError) {
        console.error(`[ERROR] Erro no processo de criação de usuário: ${userCreateError.message}`);
        
        // Última tentativa: verificar se o usuário foi criado apesar do erro
        try {
          const { data: finalCheck } = await supabase.auth.admin.listUsers();
          const userAfterError = finalCheck?.users?.find(
            user => user.email && user.email.toLowerCase() === customer.email.toLowerCase()
          );
          
          if (userAfterError) {
            userId = userAfterError.id;
            console.log(`[RECOVERY] Recuperado ID do usuário após erro: ${userId}`);
          } else {
            console.error(`[CRITICAL] Falha definitiva ao criar usuário: ${userCreateError.message}`);
            throw userCreateError;
          }
        } catch (finalError) {
          console.error(`[CRITICAL] Falha na última verificação: ${finalError.message}`);
          throw finalError;
        }
      }
      
      // Se o usuário foi criado agora, enviar email com credenciais
      if (userCreated && sendGridApiKey) {
        try {
          console.log(`[INFO] Enviando email de boas-vindas para ${customer.email}`);
          await EmailService.sendWelcomeEmail(
            customer.email, 
            tempPassword, 
            customer.name || 'Cliente'
          );
        } catch (emailError) {
          console.error(`[ERROR] Erro ao enviar email: ${emailError.message}`);
          // Não falhar por causa do email
        }
      }
    } else {
      // Usuário já existe
      userId = existingUser.id;
      console.log(`[INFO] Usuário já existe, ID: ${userId}`);
    }
    
    // Atualizar dados de assinatura no perfil
    if (userId) {
      // Criar/atualizar o perfil com informações da assinatura
      const profileData = {
        id: userId,
        email: customer.email,
        stripe_customer_id: customer.id,
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        plan_id: extractPlanId(subscription),
        is_subscribed: true,
        subscription_period_end: calculateEndDate(subscription),
        updated_at: new Date().toISOString()
      };
      
      // Se o perfil não existe, adicionar campos obrigatórios para criação
      if (!existingUser) {
        // Adicionar dados adicionais do cliente
        if (customer.name) {
          profileData.full_name = customer.name;
        }
      }
      
      console.log(`[DEBUG] Atualizando perfil com dados da assinatura: ${JSON.stringify(profileData)}`);
      
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert(profileData);
          
        if (error) {
          console.error(`[ERROR] Erro ao atualizar perfil com assinatura: ${error.message}`);
          // Tentar método alternativo
          try {
            await updateUserSubscription(userId, subscription);
            console.log(`[SUCCESS] Perfil atualizado via updateUserSubscription`);
          } catch (fallbackError) {
            console.error(`[ERROR] Falha no método alternativo: ${fallbackError.message}`);
          }
        } else {
          console.log(`[SUCCESS] Perfil atualizado com dados da assinatura`);
        }
      } catch (profileError) {
        console.error(`[ERROR] Exceção ao atualizar perfil: ${profileError.message}`);
      }
      
      // Enviar email de confirmação de assinatura para todos os usuários
      if (sendGridApiKey) {
        try {
          const planDetails = {
            name: 'Plano DRC Finanças',
            status: subscription.status,
            amount: subscription.plan ? subscription.plan.amount : null
          };
          
          console.log(`[INFO] Enviando email de confirmação de assinatura para ${customer.email}`);
          const emailResult = await EmailService.sendSubscriptionConfirmationEmail(
            customer.email, 
            planDetails, 
            customer.name || 'Cliente'
          );
          
          if (emailResult) {
            console.log(`[SUCCESS] Email de confirmação de assinatura enviado com sucesso`);
          } else {
            console.error(`[ERROR] Falha ao enviar email de confirmação de assinatura`);
          }
        } catch (emailError) {
          console.error(`[ERROR] Erro ao enviar email de confirmação: ${emailError.message}`);
        }
      }
    } else {
      console.error(`[ERROR] Não foi possível obter ID de usuário para atualizar assinatura`);
    }
  } catch (error) {
    console.error(`[ERROR] Erro ao processar assinatura: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
  }
}

/**
 * Atualiza o perfil do usuário com dados do cliente e outros dados específicos
 */
async function updateUserProfile(userId, customer, data = {}) {
  try {
    console.log(`[DEBUG] Atualizando perfil para usuário ${userId}`);
    
    // Verificar se o perfil já existe
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileCheckError) {
      console.error(`[ERROR] Erro ao verificar perfil existente: ${profileCheckError.message}`);
    }
    
    const profileExists = !!existingProfile;
    console.log(`[DEBUG] Perfil ${profileExists ? 'existe' : 'não existe'} para usuário ${userId}`);
    
    // Construir dados para o perfil
    const profileData = {
      id: userId,
      email: customer.email,
      updated_at: new Date().toISOString(),
      stripe_customer_id: customer.id
    };
    
    // Adicionar nome se disponível
    if (customer.name) {
      profileData.full_name = customer.name;
    }
    
    // Adicionar dados extras
    if (data.payment_status) {
      profileData.payment_status = data.payment_status;
    }
    
    if (data.id) {
      profileData.last_payment_id = data.id;
      profileData.last_payment_status = data.payment_status || 'paid';
      profileData.last_payment_date = new Date().toISOString();
    }
    
    // Se tiver dados de assinatura, adicionar
    if (data.subscription_id) {
      profileData.subscription_id = data.subscription_id;
      profileData.subscription_status = data.subscription_status || 'active';
      profileData.is_subscribed = true;
    }
    
    console.log(`[DEBUG] Dados do perfil para atualização: ${JSON.stringify(profileData)}`);
    
    // Tentar várias abordagens para atualizar ou criar o perfil
    const methods = [
      // Método 1: upsert direto
      async () => {
        const { error } = await supabase
          .from('profiles')
          .upsert(profileData);
          
        if (error) throw error;
        return true;
      },
      
      // Método 2: insert ou update dependendo se o perfil existe
      async () => {
        if (profileExists) {
          const { error } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', userId);
            
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('profiles')
            .insert(profileData);
            
          if (error) throw error;
        }
        return true;
      },
      
      // Método 3: SQL direto para perfis simples
      async () => {
        const insertSQL = `
        INSERT INTO public.profiles (
          id, email, full_name, stripe_customer_id, payment_status, 
          updated_at
        ) VALUES (
          '${userId}', 
          '${profileData.email}', 
          ${profileData.full_name ? `'${profileData.full_name}'` : 'NULL'},
          '${profileData.stripe_customer_id}',
          ${profileData.payment_status ? `'${profileData.payment_status}'` : 'NULL'},
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
          stripe_customer_id = EXCLUDED.stripe_customer_id,
          ${profileData.payment_status ? `payment_status = '${profileData.payment_status}',` : ''}
          updated_at = now();
        `;
        
        const { error } = await supabase.rpc('pgexecute', { query: insertSQL });
        if (error) throw error;
        return true;
      }
    ];
    
    // Tentar cada método até que um funcione
    let profileUpdated = false;
    for (let i = 0; i < methods.length; i++) {
      try {
        await methods[i]();
        console.log(`[SUCCESS] Perfil ${profileExists ? 'atualizado' : 'criado'} com sucesso (Método ${i+1})`);
        profileUpdated = true;
        break;
      } catch (error) {
        console.error(`[ERROR] Falha no método ${i+1}: ${error.message}`);
        // Continuar tentando o próximo método
      }
    }
    
    if (!profileUpdated) {
      console.error(`[WARNING] Não foi possível ${profileExists ? 'atualizar' : 'criar'} perfil após ${methods.length} tentativas`);
    }
    
    return profileUpdated;
  } catch (error) {
    console.error(`[ERROR] Erro em updateUserProfile: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
    return false;
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
    console.log(`[DEBUG] Atualizando dados de pagamento para usuário ${userId}, payment ${paymentIntent.id}`);
    
    // Verificar se o perfil já existe
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (checkError) {
      console.error(`[ERROR] Erro ao verificar perfil existente: ${checkError.message}`);
    }
    
    const profileExists = !!existingProfile;
    console.log(`[DEBUG] Perfil ${profileExists ? 'existe' : 'não existe'} para usuário ${userId}`);
    
    // Construir dados para atualização do perfil
    const profileData = {
      id: userId,
      updated_at: new Date().toISOString(),
      last_payment_id: paymentIntent.id,
      last_payment_status: paymentIntent.status || 'paid',
      last_payment_date: new Date().toISOString(),
      payment_status: paymentIntent.status || 'paid',
      is_subscribed: true,
      subscription_status: 'active'
    };
    
    // Se o perfil não existe, adicionar campos obrigatórios para criação
    if (!profileExists) {
      console.log(`[DEBUG] Preparando para criar novo perfil para usuário ${userId}`);
      
      // Buscar dados do usuário para obter email
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        
        if (userError) {
          console.error(`[ERROR] Erro ao buscar dados do usuário: ${userError.message}`);
        } else if (userData && userData.user) {
          profileData.email = userData.user.email;
          console.log(`[DEBUG] Email recuperado para novo perfil: ${userData.user.email}`);
          
          // Verificar metadata do usuário para possíveis dados adicionais
          if (userData.user.user_metadata) {
            if (userData.user.user_metadata.stripe_customer_id) {
              profileData.stripe_customer_id = userData.user.user_metadata.stripe_customer_id;
            }
            if (userData.user.user_metadata.full_name) {
              profileData.full_name = userData.user.user_metadata.full_name;
            }
          }
          
          // Adicionar campos obrigatórios que não foram definidos
          if (!profileData.stripe_customer_id && paymentIntent.customer) {
            profileData.stripe_customer_id = paymentIntent.customer;
          }
          
          // Adicionar data de criação para um novo perfil
          profileData.created_at = new Date().toISOString();
        }
      } catch (userLookupError) {
        console.error(`[ERROR] Erro ao buscar usuário: ${userLookupError.message}`);
      }
    }
    
    console.log(`[DEBUG] Dados do perfil para atualização: ${JSON.stringify(profileData)}`);
    
    // Tentativas de atualização do perfil - com melhor tratamento de erros
    let profileUpdated = false;
    
    // Tentativa 1: upsert direto - preferencial
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id', ignoreDuplicates: false });
        
      if (error) {
        console.error(`[ERROR] Falha no upsert: ${error.message}`);
      } else {
        console.log(`[SUCCESS] Perfil ${profileExists ? 'atualizado' : 'criado'} com sucesso via upsert`);
        profileUpdated = true;
      }
    } catch (upsertError) {
      console.error(`[ERROR] Exceção durante upsert: ${upsertError.message}`);
    }
    
    // Tentativa 2: insert ou update específico se upsert falhar
    if (!profileUpdated) {
      try {
        if (profileExists) {
          const { error } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', userId);
            
          if (error) {
            console.error(`[ERROR] Falha no update: ${error.message}`);
          } else {
            console.log(`[SUCCESS] Perfil atualizado com sucesso via update`);
            profileUpdated = true;
          }
        } else {
          // Garantir que temos email para criação de perfil
          if (!profileData.email) {
            console.error(`[ERROR] Não foi possível criar perfil: email não disponível`);
          } else {
            const { error } = await supabase
              .from('profiles')
              .insert(profileData);
              
            if (error) {
              console.error(`[ERROR] Falha no insert: ${error.message}`);
            } else {
              console.log(`[SUCCESS] Perfil criado com sucesso via insert`);
              profileUpdated = true;
            }
          }
        }
      } catch (directError) {
        console.error(`[ERROR] Exceção durante operação direta: ${directError.message}`);
      }
    }
    
    // Verificação final - confirmar se o perfil existe após as tentativas
    if (!profileUpdated) {
      try {
        const { data: finalCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
          
        if (finalCheck) {
          console.log(`[RECOVERY] Perfil existe após tentativas, considerando operação bem-sucedida`);
          profileUpdated = true;
        } else {
          console.error(`[CRITICAL] Perfil ainda não existe após múltiplas tentativas`);
        }
      } catch (finalError) {
        console.error(`[ERROR] Erro na verificação final: ${finalError.message}`);
      }
    }
    
    return profileUpdated;
  } catch (error) {
    console.error(`[ERROR] Erro em updateUserPayment: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
    return false;
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