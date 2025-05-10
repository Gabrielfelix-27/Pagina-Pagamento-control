// Serviço de email usando SendGrid
// Supabase Edge Functions não suportam importações de módulos ESM diretamente, então usamos fetch

// Configurações do SendGrid
const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";
const sendGridApiUrl = "https://api.sendgrid.com/v3/mail/send";

// Detalhes do remetente e aplicação
const emailFrom = Deno.env.get("EMAIL_FROM") || "DRC Finanças <noreply@drcfinancas.com.br>";
const appUrl = Deno.env.get("APP_URL") || "https://app.drcfinancas.com.br";

// Logs de diagnóstico no início
console.log(`[EMAIL_SERVICE] Inicializando serviço de email`);
console.log(`[EMAIL_SERVICE] SendGrid API Key configurada: ${!!sendGridApiKey}`);
console.log(`[EMAIL_SERVICE] Email remetente: ${emailFrom}`);
console.log(`[EMAIL_SERVICE] URL da aplicação: ${appUrl}`);

/**
 * Serviço de email para envio de mensagens através do SendGrid
 */
export class EmailService {
  /**
   * Método interno para enviar email via SendGrid
   * @param to Email do destinatário
   * @param subject Assunto do email
   * @param htmlContent Conteúdo HTML do email
   * @param from Email do remetente (opcional)
   */
  private static async sendEmail(to: string, subject: string, htmlContent: string, from: string = emailFrom): Promise<boolean> {
    try {
      console.log(`[EMAIL_SERVICE] Iniciando envio de email para ${to} com assunto "${subject}"`);
      
      if (!sendGridApiKey) {
        console.error("[EMAIL_SERVICE] ERRO CRÍTICO: SendGrid API Key não configurada!");
        console.error("[EMAIL_SERVICE] Verifique se a variável de ambiente SENDGRID_API_KEY está configurada no Supabase.");
        return false;
      }
      
      console.log(`[EMAIL_SERVICE] Preparando payload para SendGrid`);
      const payload = {
        personalizations: [
          {
            to: [{ email: to }],
            subject: subject,
          }
        ],
        from: { email: from.includes("<") ? from.match(/<(.+)>/)?.[1] || from : from },
        content: [
          {
            type: "text/html",
            value: htmlContent
          }
        ]
      };
      
      console.log(`[EMAIL_SERVICE] Enviando requisição para SendGrid API`);
      const response = await fetch(sendGridApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendGridApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[EMAIL_SERVICE] ERRO: SendGrid respondeu com status ${response.status}`);
        console.error(`[EMAIL_SERVICE] Resposta de erro do SendGrid: ${errorData}`);
        
        // Logs adicionais para diagnóstico
        console.error(`[EMAIL_SERVICE] Verifique se:`);
        console.error(`[EMAIL_SERVICE] 1. A API Key do SendGrid é válida`);
        console.error(`[EMAIL_SERVICE] 2. O email remetente (${from}) está verificado no SendGrid`);
        console.error(`[EMAIL_SERVICE] 3. O formato do email está correto`);
        return false;
      }
      
      console.log(`[EMAIL_SERVICE] Email enviado com sucesso para ${to}`);
      return true;
    } catch (error) {
      console.error(`[EMAIL_SERVICE] ERRO ao enviar email: ${error.message}`);
      console.error(`[EMAIL_SERVICE] Stack trace: ${error.stack || 'Não disponível'}`);
      return false;
    }
  }

  /**
   * Envia um email de boas-vindas para o usuário com suas credenciais de acesso
   * @param email Email do destinatário
   * @param password Senha temporária gerada
   * @param name Nome do destinatário (opcional)
   */
  static async sendWelcomeEmail(email: string, password: string, name: string = 'Cliente'): Promise<boolean> {
    try {
      console.log(`[INFO] Enviando email de boas-vindas para ${email}`);
      
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
      
      return await this.sendEmail(
        email,
        "Bem-vindo ao DRC Finanças - Suas Credenciais de Acesso",
        htmlBody
      );
    } catch (error) {
      console.error(`[ERROR] Erro ao enviar email: ${error.message}`);
      return false;
    }
  }

  /**
   * Envia um email de recuperação de senha
   * @param email Email do destinatário
   * @param resetLink Link para resetar a senha
   * @param name Nome do destinatário (opcional)
   */
  static async sendPasswordResetEmail(email: string, resetLink: string, name: string = 'Cliente'): Promise<boolean> {
    try {
      console.log(`[INFO] Enviando email de recuperação de senha para ${email}`);
      
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
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; 
                  text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperação de Senha</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${name}</strong>,</p>
            <p>Recebemos uma solicitação para redefinir sua senha no DRC Finanças.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            
            <a href="${resetLink}" class="button">Redefinir Senha</a>
            
            <p>Este link é válido por 24 horas. Se você não solicitou esta redefinição, ignore este e-mail.</p>
            
            <p>Atenciosamente,<br>Equipe DRC Finanças</p>
          </div>
          <div class="footer">
            <p>Este é um e-mail automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
      </html>
      `;
      
      return await this.sendEmail(
        email,
        "Recuperação de Senha - DRC Finanças",
        htmlBody
      );
    } catch (error) {
      console.error(`[ERROR] Erro ao enviar email de recuperação: ${error.message}`);
      return false;
    }
  }

  /**
   * Envia um email de confirmação de assinatura
   * @param email Email do destinatário 
   * @param planDetails Detalhes do plano assinado
   * @param name Nome do destinatário (opcional)
   */
  static async sendSubscriptionConfirmationEmail(email: string, planDetails: any, name: string = 'Cliente'): Promise<boolean> {
    try {
      console.log(`[INFO] Enviando email de confirmação de assinatura para ${email}`);
      
      // Formatação do valor do plano
      const planValue = planDetails.amount 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(planDetails.amount / 100)
        : 'Valor não disponível';
      
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
          .plan-details { background-color: #eee; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; 
                  text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Assinatura Confirmada!</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${name}</strong>,</p>
            <p>Sua assinatura do DRC Finanças foi confirmada com sucesso!</p>
            
            <div class="plan-details">
              <p><strong>Plano:</strong> ${planDetails.name || 'Plano DRC Finanças'}</p>
              <p><strong>Valor:</strong> ${planValue}</p>
              <p><strong>Status:</strong> ${planDetails.status || 'Ativo'}</p>
            </div>
            
            <p>Agora você tem acesso completo a todas as funcionalidades do DRC Finanças.</p>
            
            <a href="${appUrl}/dashboard" class="button">Acessar Minha Conta</a>
            
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
      
      return await this.sendEmail(
        email,
        "Assinatura Confirmada - DRC Finanças",
        htmlBody
      );
    } catch (error) {
      console.error(`[ERROR] Erro ao enviar email de confirmação: ${error.message}`);
      return false;
    }
  }
}

// Função utilitária para gerar uma senha aleatória segura
export function generateRandomPassword() {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]\\:;?><,./-=";
  let password = "";
  
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  
  return password;
} 