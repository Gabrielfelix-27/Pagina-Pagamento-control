import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { EmailService } from "../_shared/email-service.ts";

// Cabeçalhos CORS simplificados
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

console.log("[✓] Função test-email inicializada");

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
    // Configurações do SendGrid - verificar se está definido
    const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";
    if (!sendGridApiKey) {
      console.error("[CRITICAL] SendGrid API Key não está configurada!");
      return new Response(
        JSON.stringify({ 
          error: "SendGrid API Key não configurada",
          message: "Configure a variável de ambiente SENDGRID_API_KEY"
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    let emailTo = "";
    
    // Obtém o email de teste do corpo da requisição se for POST
    if (req.method === "POST") {
      const body = await req.json();
      emailTo = body.email || "";
    }
    
    // Se não foi fornecido email no corpo, usa um padrão ou query param
    if (!emailTo) {
      const url = new URL(req.url);
      emailTo = url.searchParams.get("email") || "teste@exemplo.com";
    }

    console.log(`[INFO] Enviando email de teste para: ${emailTo}`);
    
    // Gerar uma senha de teste
    const testPassword = "Senha_Teste_123!";
    
    // Enviar email de teste
    const startTime = Date.now();
    const emailResult = await EmailService.sendWelcomeEmail(
      emailTo,
      testPassword,
      "Usuário de Teste"
    );
    const endTime = Date.now();
    
    // Resultado do envio
    if (emailResult) {
      console.log(`[SUCCESS] Email enviado com sucesso para ${emailTo}`);
      console.log(`[INFO] Tempo para envio: ${endTime - startTime}ms`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Email enviado com sucesso para ${emailTo}`,
          timing_ms: endTime - startTime
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } else {
      console.error(`[ERROR] Falha ao enviar email para ${emailTo}`);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `Falha ao enviar email para ${emailTo}. Verifique os logs para mais detalhes.`,
          timing_ms: endTime - startTime
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
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