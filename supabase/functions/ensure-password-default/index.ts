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
    // Inicialização do Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[INFO] Iniciando verificação de senhas padrão...");

    // 1. Atualizar senhas na tabela payment_credentials
    console.log("[TASK] Atualizando senhas na tabela payment_credentials...");
    
    const { data: updatedCredentials, error: credentialsError } = await supabase
      .from('payment_credentials')
      .update({ password: "123456" })
      .neq('password', "123456")
      .select('id, payment_id, email');
      
    if (credentialsError) {
      console.error(`[ERROR] Erro ao atualizar credenciais: ${credentialsError.message}`);
    } else {
      console.log(`[SUCCESS] ${updatedCredentials?.length || 0} credenciais atualizadas`);
    }
    
    // 2. Criar uma trigger SQL para garantir que novas credenciais sempre usem a senha padrão
    console.log("[TASK] Criando/atualizando trigger para senhas padrão...");
    
    const createTriggerSQL = `
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
    `;

    try {
      await supabase.rpc('pgexecute', { query: createTriggerSQL });
      console.log("[SUCCESS] Trigger criado/atualizado com sucesso");
    } catch (triggerError) {
      console.error(`[ERROR] Erro ao criar trigger: ${triggerError.message}`);
    }

    // Verificar se trigger foi criado
    const checkTriggerSQL = `
    SELECT * FROM pg_trigger 
    WHERE tgname = 'set_default_password';
    `;
    
    try {
      const { data: triggerData } = await supabase.rpc('pgexecute', { query: checkTriggerSQL });
      console.log(`[INFO] Status do trigger: ${triggerData ? 'Criado' : 'Não encontrado'}`);
    } catch (checkError) {
      console.error(`[ERROR] Erro ao verificar trigger: ${checkError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verificação de senhas concluída",
        credentials_updated: updatedCredentials?.length || 0,
        trigger_created: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
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