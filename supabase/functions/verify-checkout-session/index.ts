import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.9.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

console.log("[✓] Função verify-checkout-session inicializada");

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

    // Extrair os dados da requisição
    const requestData = await req.json();
    const { session_id } = requestData;

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "Sessão não fornecida" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[INFO] Verificando sessão: ${session_id}`);

    // Obter detalhes da sessão no Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer', 'payment_intent', 'subscription']
    });

    console.log(`[INFO] Status da sessão: ${session.payment_status}`);

    // Verificar se o pagamento foi concluído
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Pagamento não foi concluído",
          status: session.payment_status
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obter o email do cliente
    const customerEmail = session.customer_email || (session.customer && 'email' in session.customer ? session.customer.email : null);
    
    if (!customerEmail) {
      console.error("[ERROR] Email do cliente não encontrado na sessão");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Informações do cliente não encontradas"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o usuário foi criado no Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', customerEmail)
      .maybeSingle();

    // Fallback para a tabela profiles se não encontrar na tabela users
    let userExists = !!userData;
    let userId = userData?.id;

    if (!userExists) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .maybeSingle();

      userExists = !!profileData;
      userId = profileData?.id;

      if (profileError) {
        console.error(`[ERROR] Erro ao buscar perfil: ${profileError.message}`);
      }
    }

    console.log(`[INFO] Usuário existe: ${userExists ? 'Sim' : 'Não'}`);

    // Se o usuário não existir, talvez o webhook não tenha sido processado ainda
    // Neste caso, vamos verificar se o pagamento foi bem-sucedido e criar o usuário
    if (!userExists) {
      console.log("[INFO] Usuário não encontrado. Criando manualmente...");
      
      // Gerar uma senha temporária
      const tempPassword = generateRandomPassword();
      
      // Criar o usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
        password: tempPassword,
        user_metadata: {
          full_name: session.customer_details?.name || '',
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
          payment_status: session.payment_status,
          subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          created_via: 'verify-checkout-session'
        }
      });
      
      if (authError) {
        console.error(`[ERROR] Erro ao criar usuário: ${authError.message}`);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Falha ao criar o usuário. Por favor, entre em contato com o suporte."
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log(`[SUCCESS] Usuário criado com sucesso: ${authData.user.id}`);
      userId = authData.user.id;
      
      // Atualizar o perfil com informações adicionais
      await updateUserProfile(authData.user.id, session);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Usuário criado com sucesso",
          email: customerEmail,
          password: tempPassword // Em produção, não envie a senha na resposta - apenas um aviso que foi enviada por email
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Se o usuário já existe, retorna os detalhes
    return new Response(
      JSON.stringify({
        success: true,
        message: "Pagamento confirmado e usuário encontrado",
        email: customerEmail,
        userId
      }),
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
        success: false,
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
 * Atualiza o perfil do usuário com dados adicionais
 */
async function updateUserProfile(userId: string, session: any) {
  try {
    // Obter informações adicionais que queremos salvar
    const currentDate = new Date().toISOString();
    
    // Atualizar o perfil do usuário na tabela 'profiles'
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        updated_at: currentDate,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        subscription_status: 'active',
        subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
        payment_status: session.payment_status,
        is_subscribed: true,
        email: session.customer_email || (session.customer && 'email' in session.customer ? session.customer.email : null),
        subscription_period_end: calculateSubscriptionEndDate(session)
      });

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
 * Calcula a data de término da assinatura
 */
function calculateSubscriptionEndDate(session: any) {
  try {
    // Se for uma assinatura, calcular baseado na duração do plano
    if (session.subscription) {
      const subscription = typeof session.subscription === 'string' ? null : session.subscription;
      
      if (subscription && subscription.current_period_end) {
        return new Date(subscription.current_period_end * 1000).toISOString();
      }
      
      // Fallback para um mês a partir de agora
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