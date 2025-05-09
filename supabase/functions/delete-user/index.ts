import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  // Responde a requisições preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Verificar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obter token de autorização
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Token de autorização não fornecido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extrair token
    const token = authHeader.substring(7);
    
    // Inicializar o cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Erro de configuração do servidor" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Cliente com chave de serviço para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Verificar se o usuário está autenticado
    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado", details: authError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Verificar se o usuário tem o papel de administrador
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();
    
    const isAdmin = profile?.role === 'admin';
    
    // Obter dados da requisição
    const requestData = await req.json();
    const { userId } = requestData;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID do usuário não fornecido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Verificar permissões - apenas administradores ou o próprio usuário podem excluir
    if (!isAdmin && userId !== authUser.id) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para excluir este usuário" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Excluir usuário do Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error(`[ERROR] Erro ao excluir usuário: ${deleteError.message}`);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir usuário", details: deleteError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Excluir dados na tabela profiles (deve ser configurada com delete cascade no RLS)
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileDeleteError) {
      console.warn(`[WARN] Erro ao excluir perfil: ${profileDeleteError.message}`);
      // Não falha a operação se apenas o perfil falhou
    }
    
    return new Response(
      JSON.stringify({ success: true, message: "Usuário excluído com sucesso" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error(`[ERROR] Erro geral: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
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