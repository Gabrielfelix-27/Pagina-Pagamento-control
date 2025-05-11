// Serviço de Email para uso nas funções Edge do Supabase
// Este arquivo deve ser importado como "../_shared/email-service.ts"

// Gerador de senha aleatória
export function generateRandomPassword(length = 10) {
  // Sempre retorna a senha padrão "123456", ignorando o parâmetro de comprimento
  return "123456";
}

// Serviço de Email simplificado
export const EmailService = {
  // Email de boas-vindas com credenciais
  async sendWelcomeEmail(toEmail: string, password: string, name: string): Promise<boolean> {
    try {
      const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";
      const emailFrom = Deno.env.get("EMAIL_FROM") || "DRC Finanças <noreply@drcfinancas.com.br>";
      const appUrl = Deno.env.get("APP_URL") || "https://app.drcfinancas.com.br";
      
      console.log(`[EMAIL_SERVICE] Inicializando serviço de email de boas-vindas`);
      console.log(`[EMAIL_SERVICE] SendGrid API Key configurada: ${!!sendGridApiKey}`);
      console.log(`[EMAIL_SERVICE] Email remetente configurado: ${emailFrom}`);
      
      if (!sendGridApiKey) {
        console.error("[CRITICAL] SendGrid API Key não está configurada!");
        return false;
      }
      
      const content = `
        <h1>Bem-vindo ao DRC Finanças!</h1>
        <p>Olá ${name},</p>
        <p>Seu acesso foi criado com sucesso e suas credenciais foram exibidas na tela de confirmação do pagamento.</p>
        <p>Este email serve como um <strong>backup</strong> de suas informações de acesso:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <p><strong>Email:</strong> ${toEmail}</p>
          <p><strong>Senha:</strong> ${password}</p>
        </div>
        
        <p><strong>Importante:</strong> Por motivos de segurança, recomendamos que você altere sua senha após o primeiro acesso.</p>
        
        <p>Para acessar o DRC Finanças, clique no botão abaixo:</p>
        
        <p><a href="${appUrl}/login" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Ir para o DRC Finanças</a></p>
        
        <p>Atenciosamente,<br>Equipe DRC Finanças</p>
      `;
      
      const data = {
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: emailFrom.includes("<") ? emailFrom.match(/<(.+)>/)?.[1] || emailFrom : emailFrom },
        subject: "DRC Finanças - Backup das suas Credenciais de Acesso",
        content: [{ type: "text/html", value: content }]
      };
      
      console.log("[EMAIL_SERVICE] Enviando email de boas-vindas para:", toEmail);
      
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendGridApiKey}`
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log(`[EMAIL_SERVICE] Email enviado com sucesso para ${toEmail}`);
        return true;
      } else {
        const errorText = await response.text();
        console.error(`[EMAIL_SERVICE] ERRO: SendGrid respondeu com status ${response.status}`, errorText);
        return false;
      }
    } catch (error) {
      console.error(`[EMAIL_SERVICE] ERRO ao enviar email: ${error.message}`);
      return false;
    }
  },

  // Email de confirmação de assinatura
  async sendSubscriptionConfirmationEmail(toEmail: string, planDetails: any, name: string): Promise<boolean> {
    try {
      const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";
      const emailFrom = Deno.env.get("EMAIL_FROM") || "DRC Finanças <noreply@drcfinancas.com.br>";
      const appUrl = Deno.env.get("APP_URL") || "https://app.drcfinancas.com.br";
      
      console.log(`[EMAIL_SERVICE] Enviando email de confirmação de assinatura`);
      console.log(`[EMAIL_SERVICE] SendGrid API Key configurada: ${!!sendGridApiKey}`);
      
      if (!sendGridApiKey) {
        console.error("[CRITICAL] SendGrid API Key não está configurada!");
        return false;
      }
      
      // Formatação do valor do plano
      const planValue = planDetails.amount 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(planDetails.amount / 100)
        : 'Valor não disponível';
      
      const content = `
        <h1>Assinatura Confirmada!</h1>
        <p>Olá ${name},</p>
        <p>Sua assinatura do DRC Finanças foi confirmada com sucesso!</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <p><strong>Plano:</strong> ${planDetails.name || 'Plano DRC Finanças'}</p>
          <p><strong>Valor:</strong> ${planValue}</p>
          <p><strong>Status:</strong> ${planDetails.status || 'Ativo'}</p>
        </div>
        
        <p>Agora você tem acesso completo a todas as funcionalidades do DRC Finanças.</p>
        
        <p><a href="${appUrl}/dashboard" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Acessar Minha Conta</a></p>
        
        <p>Atenciosamente,<br>Equipe DRC Finanças</p>
      `;
      
      const data = {
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: emailFrom.includes("<") ? emailFrom.match(/<(.+)>/)?.[1] || emailFrom : emailFrom },
        subject: "Assinatura Confirmada - DRC Finanças",
        content: [{ type: "text/html", value: content }]
      };
      
      console.log("[EMAIL_SERVICE] Enviando email de confirmação para:", toEmail);
      
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendGridApiKey}`
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log(`[EMAIL_SERVICE] Email de confirmação enviado com sucesso para ${toEmail}`);
        return true;
      } else {
        const errorText = await response.text();
        console.error(`[EMAIL_SERVICE] ERRO: SendGrid respondeu com status ${response.status}`, errorText);
        return false;
      }
    } catch (error) {
      console.error(`[EMAIL_SERVICE] ERRO ao enviar email de confirmação: ${error.message}`);
      return false;
    }
  }
}; 