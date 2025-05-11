import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Cabeçalhos CORS simplificados
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
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
    const { sql_query, action } = requestData;

    if (!sql_query && !action) {
      return new Response(
        JSON.stringify({ error: "É necessário fornecer um SQL ou uma ação" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Inicialização do Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Se for uma ação pré-definida
    if (action === "enforce_default_password") {
      console.log("[INFO] Executando ação: enforce_default_password");
      
      const passwordTriggerSQL = `
        -- Função que será executada pelo trigger
        CREATE OR REPLACE FUNCTION enforce_default_password()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Sempre define a senha como 123456
          NEW.password = '123456';
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Remover o trigger se já existir
        DROP TRIGGER IF EXISTS set_default_password ON payment_credentials;

        -- Criar o trigger
        CREATE TRIGGER set_default_password
        BEFORE INSERT OR UPDATE OF password ON payment_credentials
        FOR EACH ROW
        EXECUTE FUNCTION enforce_default_password();

        -- Atualizar todas as senhas existentes
        UPDATE payment_credentials 
        SET password = '123456' 
        WHERE password IS NOT NULL AND password != '123456';
      `;
      
      const { error: sqlError } = await supabase.rpc('pgexecute', { query: passwordTriggerSQL });
      
      if (sqlError) {
        console.error(`[ERROR] Erro ao executar SQL para senhas padrão: ${sqlError.message}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: sqlError.message,
            action: "enforce_default_password"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log(`[SUCCESS] Trigger de senha padrão criado e senhas atualizadas com sucesso!`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Trigger de senha padrão criado e senhas atualizadas com sucesso",
          action: "enforce_default_password"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Se for um SQL personalizado
    if (sql_query) {
      console.log(`[INFO] Executando SQL personalizado`);
      const { error: sqlError } = await supabase.rpc('pgexecute', { query: sql_query });
      
      if (sqlError) {
        console.error(`[ERROR] Erro ao executar SQL personalizado: ${sqlError.message}`);
        return new Response(
          JSON.stringify({ success: false, error: sqlError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log(`[SUCCESS] SQL executado com sucesso!`);
      
      return new Response(
        JSON.stringify({ success: true, message: "SQL executado com sucesso" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Requisição inválida" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`[ERROR] Erro geral: ${error.message}`);
    
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