# Pagina-Pagamento-control

Sistema de pagamentos integrado com Stripe e Supabase.

## Configuração de Envio de Emails

O sistema utiliza o SendGrid para enviar emails transacionais (confirmação de pagamento, credenciais de acesso, etc).

### Configuração do SendGrid

1. Crie uma conta no [SendGrid](https://sendgrid.com/)
2. Obtenha uma API Key no painel do SendGrid em Settings > API Keys
3. Configure as seguintes variáveis de ambiente no projeto Supabase:

```
SENDGRID_API_KEY=sua_api_key_do_sendgrid
EMAIL_FROM=DRC Finanças <seu-email-verificado@seudominion.com>
APP_URL=https://app.drcfinancas.com.br
```

4. Importante: Verifique o domínio do e-mail remetente no SendGrid para garantir uma boa taxa de entrega.

### Emails Enviados

O sistema enviará os seguintes emails:

1. **Email de Boas-vindas**: Quando um usuário é cadastrado após um pagamento bem-sucedido, contendo suas credenciais de acesso.
2. **Email de Confirmação de Assinatura**: Quando uma assinatura é confirmada ou renovada.
3. **Email de Recuperação de Senha**: Quando o usuário solicita redefinição de senha.

## Integração com Stripe

Este projeto utiliza Stripe para processamento de pagamentos e gerenciamento de assinaturas. Após um pagamento bem-sucedido, um usuário é automaticamente criado no Supabase.

## Configuração do Webhook

Para garantir que os usuários sejam criados automaticamente após o pagamento, o webhook da Stripe deve estar configurado corretamente. 

### Variáveis de Ambiente Necessárias

Configure as seguintes variáveis de ambiente no Supabase Dashboard:

```
STRIPE_PUBLISHABLE_KEY=pk_test_51RFmAZRwUl4uJKT1BkJVrrgZgSXaMQzD6Z1ChAD855BrDlHZWStPhogtounwGLr6FpNXITkUQo8OFjLEG1BfNk5K0016UxHWuj
STRIPE_SECRET_KEY=sk_test_51RFmAZRwUl4uJKT1qJpMNZtBEDH1WyiowtrYBVsad1GPcQt8GYYpX7mu1ZWMmpaZgR21MsKXY4tyz7hA2G6Ozenm00HPhENGc0
STRIPE_WEBHOOK_SECRET=whsec_m37ENzGMIv9SToIgzFyGDgBqd3pxwG6z
```

### URL do Webhook

Configure o webhook no Dashboard da Stripe com a seguinte URL:

```
https://gyogfvfmsotveacjcckr.supabase.co/functions/v1/stripe-webhook
```

### Eventos do Webhook

O webhook deve estar configurado para escutar os seguintes eventos:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.subscription.created`

### Documentação Adicional

Para uma documentação mais detalhada, consulte:

- [CONFIGURACAO-STRIPE.md](CONFIGURACAO-STRIPE.md) - Guia de configuração
- [VERIFICACAO-WEBHOOK.md](VERIFICACAO-WEBHOOK.md) - Guia de resolução de problemas

## Implantação Manual via Supabase Console

Se você estiver tendo problemas com o CLI do Supabase, siga estas etapas para implantar manualmente:

1. Acesse o [Dashboard do Supabase](https://app.supabase.io)
2. Selecione seu projeto
3. Vá para **Edge Functions** no menu lateral
4. Para cada função (stripe-webhook):
   - Clique em **New Function**
   - Dê o nome apropriado à função
   - Faça upload dos arquivos ou cole o conteúdo diretamente
   - Clique em **Deploy Function**
5. Para configurar a variável de ambiente do SendGrid:
   - Vá para **Settings** > **API** 
   - Role para baixo até a seção **Environment variables**
   - Adicione `SENDGRID_API_KEY`
   - Adicione `EMAIL_FROM`
   - Adicione `APP_URL`

Para testar a função, você pode usar o botão de teste no Console ou configurar um webhook no Stripe apontando para a URL da sua função.
