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

    console.log("[INFO] Iniciando atualização de senhas em payment_credentials");

    // Atualizar todas as senhas na tabela payment_credentials para "123456"
    const { data, error } = await supabase
      .from('payment_credentials')
      .update({ password: "123456" })
      .neq('password', "123456")
      .select('id, email, payment_id, password');

    if (error) {
      console.error(`[ERROR] Erro ao atualizar senhas: ${error.message}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: error.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[SUCCESS] ${data?.length || 0} registros atualizados com sucesso`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${data?.length || 0} registros atualizados para a senha padrão "123456"`,
        updated_records: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error(`[ERROR] Erro inesperado: ${error.message}`);
    
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