import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

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

// Configurações de e-mail
const smtpConfig = {
  hostname: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
  port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
  username: Deno.env.get("SMTP_USERNAME") || "",
  password: Deno.env.get("SMTP_PASSWORD") || ""
};

// Detalhes do remetente do e-mail
const emailFrom = Deno.env.get("EMAIL_FROM") || "Drc Finanças <noreply@drcfinancas.com.br>";
const appUrl = Deno.env.get("APP_URL") || "https://app.drcfinancas.com.br";

// Chave de webhook para verificar assinatura
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

console.log("[✓] Função stripe-webhook inicializada");
console.log(`[INFO] Configuração SMTP: ${smtpConfig.hostname}:${smtpConfig.port}`);
console.log(`[INFO] Supabase URL está configurada: ${!!supabaseUrl}`);
console.log(`[INFO] Supabase Service Key está configurada: ${!!supabaseServiceKey}`);
console.log(`[INFO] Stripe Secret Key está configurada: ${!!stripeSecretKey}`);
console.log(`[INFO] Webhook Secret está configurada: ${!!endpointSecret}`);

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
  console.log('[INFO] Processando checkout.session.completed');
  console.log(`[INFO] ID da sessão: ${session.id}`);
  console.log(`[INFO] Status: ${session.status}`);
  console.log(`[INFO] Customer: ${session.customer}`);

  // Só continua se o status for pago
  if (session.payment_status !== 'paid') {
    console.log(`[INFO] Sessão não paga, status: ${session.payment_status}`);
    return;
  }

  try {
    // Obter dados do cliente no Stripe
    const customer = await stripe.customers.retrieve(session.customer);
    console.log(`[INFO] Cliente recuperado: ${customer.email}`);

    // Verificar se o usuário já existe no Supabase
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();

    if (searchError) {
      console.error(`[ERROR] Erro ao listar usuários: ${searchError.message}`);
      throw searchError;
    }

    // Verifica se o email já existe na lista de usuários
    const userExists = existingUsers.users.some(user => user.email === customer.email);

    // Se o usuário já existe, apenas atualize a assinatura
    if (userExists) {
      console.log(`[INFO] Usuário já existe no Supabase: ${customer.email}`);
      
      // Procurar o ID do usuário pelo email
      const existingUser = existingUsers.users.find(user => user.email === customer.email);
      if (existingUser) {
        await updateUserSubscription(existingUser.id, session);
      }
    return;
  }

    // Gerar senha temporária segura
    const tempPassword = generateRandomPassword();
    console.log(`[INFO] Senha temporária gerada para ${customer.email}`);

    // Criar um novo usuário com autenticação no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customer.email,
      email_confirm: true,
      user_metadata: {
        full_name: customer.name || '',
        stripe_customer_id: customer.id,
        subscription_status: session.payment_status
      },
      password: tempPassword
    });

    if (authError) {
      console.error(`[ERROR] Erro ao criar usuário no Auth: ${authError.message}`);
      throw authError;
    }

    console.log(`[SUCCESS] Usuário criado com sucesso: ${authData.user.id}`);

    // Atualizar perfil do usuário com dados adicionais
    await updateUserProfile(authData.user.id, customer, session);
    
    // Loggar as credenciais para debug (remover em produção)
    console.log(`[DEBUG] Credenciais: Email=${customer.email}, Senha=${tempPassword}`);
    
    // Enviar email de boas-vindas com credenciais
    try {
      await sendWelcomeEmail(customer.email, tempPassword, customer.name || 'Cliente');
    } catch (emailError) {
      console.error(`[ERROR] Erro ao enviar email, mas usuário foi criado: ${emailError.message}`);
      // Não falha o processo apenas por erro de email
    }

    console.log(`[SUCCESS] Processamento completo para ${customer.email}`);
  } catch (error) {
    console.error(`[ERROR] Erro ao processar checkout completo: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
    // Em produção, considere adicionar à fila para retry ou notificar administrador
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
  console.log(`[INFO] Payload: ${JSON.stringify(paymentIntent).substring(0, 200)}...`);
  
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
    
    if (!customer.email) {
      console.error(`[ERROR] Cliente ${customer.id} não tem email definido`);
      return;
    }
    
    // Verificar se já existe no Supabase
    let existingUser = null;
    try {
      const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
      
      if (searchError) {
        console.error(`[ERROR] Erro ao listar usuários: ${searchError.message}`);
        throw searchError;
      }
      
      // Verifica se o email já existe na lista de usuários
      existingUser = existingUsers.users.find(user => user.email === customer.email);
    } catch (error) {
      console.error(`[ERROR] Erro ao buscar usuário: ${error.message}`);
      // Continue mesmo com erro para tentar criar usuário
    }
    
    // Se já existe, atualizar registro
    if (existingUser) {
      console.log(`[INFO] Usuário já existe, atualizando pagamento: ${existingUser.id}`);
      try {
        await updateUserPayment(existingUser.id, paymentIntent);
      } catch (updateError) {
        console.error(`[ERROR] Erro ao atualizar usuário: ${updateError.message}`);
      }
      return;
    }
    
    // Se chegou aqui, usuário não existe e precisamos criar
    console.log(`[INFO] Criando usuário para ${customer.email} após payment_intent ${paymentIntent.id}`);
    
    // Gerar senha temporária segura
    const tempPassword = generateRandomPassword();
    console.log(`[INFO] Senha temporária gerada para ${customer.email}`);

    // Criar um novo usuário com autenticação no Auth
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: customer.email,
        email_confirm: true,
        user_metadata: {
          full_name: customer.name || '',
          stripe_customer_id: customer.id,
          payment_intent_id: paymentIntent.id,
          payment_status: paymentIntent.status,
          created_from: 'payment_intent'
        },
        password: tempPassword
      });

      if (authError) {
        console.error(`[ERROR] Erro ao criar usuário no Auth: ${authError.message}`);
        throw authError;
      }

      console.log(`[SUCCESS] Usuário criado com sucesso: ${authData.user.id}`);

      // Atualizar perfil do usuário com dados adicionais
      try {
        await updateUserProfile(authData.user.id, customer, { 
          payment_status: paymentIntent.status,
          id: paymentIntent.id
        });
      } catch (profileError) {
        console.error(`[ERROR] Erro ao atualizar perfil: ${profileError.message}, mas usuário foi criado`);
      }
      
      // Loggar as credenciais para debug (remover em produção)
      console.log(`[DEBUG] Credenciais para ${customer.email}: Senha=${tempPassword}`);
      
      // Enviar email de boas-vindas com credenciais
      try {
        await sendWelcomeEmail(customer.email, tempPassword, customer.name || 'Cliente');
      } catch (emailError) {
        console.error(`[ERROR] Erro ao enviar email, mas usuário foi criado: ${emailError.message}`);
      }

      console.log(`[SUCCESS] Processamento completo para ${customer.email}`);
    } catch (createError) {
      console.error(`[ERROR] Erro fatal ao criar usuário: ${createError.message}`);
      console.error(`[ERROR] Stack trace: ${createError.stack || 'Não disponível'}`);
    }
  } catch (error) {
    console.error(`[ERROR] Erro em processCustomerFromPayment: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack || 'Não disponível'}`);
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
    const { data: existingUser, error: searchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', customer.email)
      .maybeSingle();
      
    if (searchError) {
      console.error(`[ERROR] Erro ao buscar usuário: ${searchError.message}`);
      throw searchError;
    }
    
    if (existingUser) {
      await updateUserSubscription(existingUser.id, subscription);
      return;
    }
    
    // Lógica para criar usuário similar ao checkout.session.completed
    // Omitido para evitar duplicação
  } catch (error) {
    console.error(`[ERROR] Erro ao processar assinatura: ${error.message}`);
  }
}

/**
 * Atualiza o perfil do usuário com dados adicionais
 */
async function updateUserProfile(userId, customer, data) {
  try {
    // Obter informações adicionais que queremos salvar
    const currentDate = new Date().toISOString();

    // Determinar se estamos lidando com uma sessão de checkout ou um pagamento direto
    const isCheckoutSession = data && data.payment_status;
    const isPaymentIntent = data && data.status;
    
    // Informações a serem salvas
    const profileData = {
      id: userId,
      updated_at: currentDate,
      stripe_customer_id: customer.id,
      is_subscribed: true
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
    
    // Atualizar o perfil do usuário na tabela 'profiles'
    const { error } = await supabase
      .from('profiles')
      .upsert(profileData);

    if (error) {
      console.error(`[ERROR] Erro ao atualizar perfil: ${error.message}`);
      throw error;
    }
    
    console.log(`[SUCCESS] Perfil atualizado para usuário ${userId}`);
  } catch (error) {
    console.error(`[ERROR] Erro em updateUserProfile: ${error.message}`);
    throw error;
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
 * Envia email de boas-vindas com credenciais de acesso
 */
async function sendWelcomeEmail(email, password, name) {
  try {
    console.log(`[INFO] Enviando email de boas-vindas para ${email}`);
    
    // Verificar configurações SMTP
    if (!smtpConfig.username || !smtpConfig.password) {
      console.error("[ERROR] Configurações SMTP incompletas");
      return;
    }
    
    // Criar cliente SMTP
    const client = new SmtpClient();
    
    // Conectar ao servidor SMTP
    await client.connectTLS({
      hostname: smtpConfig.hostname,
      port: smtpConfig.port,
      username: smtpConfig.username,
      password: smtpConfig.password,
    });
    
    // Corpo do email em HTML
    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .credentials { background-color: #eee; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; 
                 text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bem-vindo ao DRC Finanças!</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${name}</strong>,</p>
          <p>Seu pagamento foi processado com sucesso, e sua conta no DRC Finanças foi criada.</p>
          <p>Abaixo estão suas credenciais de acesso:</p>
          
          <div class="credentials">
            <p><strong>E-mail:</strong> ${email}</p>
            <p><strong>Senha temporária:</strong> ${password}</p>
          </div>
          
          <p><strong>Importante:</strong> Por motivos de segurança, recomendamos que você altere sua senha após o primeiro acesso.</p>
          
          <a href="${appUrl}/login" class="button">Acessar DRC Finanças</a>
          
          <p>Se você tiver alguma dúvida ou precisar de ajuda, não hesite em entrar em contato com nossa equipe de suporte.</p>
          
          <p>Atenciosamente,<br>Equipe DRC Finanças</p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático. Por favor, não responda.</p>
        </div>
      </div>
    </body>
    </html>
    `;
    
    // Enviar email
    await client.send({
      from: emailFrom,
      to: email,
      subject: "Bem-vindo ao DRC Finanças - Suas Credenciais de Acesso",
      content: htmlBody,
      html: htmlBody
    });
    
    // Fechar conexão
    await client.close();
    
    console.log(`[SUCCESS] Email enviado para ${email}`);
  } catch (error) {
    console.error(`[ERROR] Erro ao enviar email: ${error.message}`);
    // Mesmo com erro no envio de email, não lançamos exceção para não interromper o fluxo
    // Em uma aplicação real, considere registrar esse erro e tentar novamente mais tarde
  }
}

/**
 * Gera uma senha aleatória segura
 */
function generateRandomPassword() {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]\\:;?><,./-=";
  let password = "";
  
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  
  return password;
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