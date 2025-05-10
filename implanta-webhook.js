// Script para testar o webhook do Stripe após atualização com config.toml
import fetch from 'node-fetch';
import crypto from 'crypto';

// Configurações
const WEBHOOK_URL = 'https://gyogfvfmsotveacjcckr.supabase.co/functions/v1/stripe-webhook';
// O segredo do webhook - usado apenas para simulação do header stripe-signature
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_K9dbfeAvmkjvZzZjkealUjIjEcCR9Tot';

// Função para gerar um ID aleatório
function generateId() {
  return `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Função para criar uma assinatura como o Stripe faria
function generateStripeSignature(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Criar assinatura no formato que o Stripe usa
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

// Teste para verificar se o webhook está funcionando com a solução implementada
async function testWebhook() {
  console.log('\n🔍 Testando o webhook do Stripe com verify_jwt = false em config.toml\n');
  
  const customerId = generateId();
  const sessionId = generateId();
  const email = `test_${Date.now()}@example.com`;
  
  // Simular um evento de checkout.session.completed
  const checkoutEvent = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        customer: customerId,
        customer_email: email,
        payment_status: 'paid',
        status: 'complete',
        created: Math.floor(Date.now() / 1000),
        mode: 'payment',
        amount_total: 2000,
        currency: 'brl'
      }
    }
  };
  
  console.log('📤 Enviando evento de teste...');
  console.log(`📧 Email do cliente: ${email}`);
  
  // Converter o evento para string JSON
  const payload = JSON.stringify(checkoutEvent);
  
  try {
    // Gerar uma assinatura semelhante à do Stripe
    const stripeSignature = generateStripeSignature(payload);
    console.log(`🔐 Assinatura gerada: ${stripeSignature.substring(0, 30)}...`);
    
    // Enviar a requisição com o cabeçalho stripe-signature
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': stripeSignature
      },
      body: payload
    });
    
    // Obter a resposta
    let responseText;
    try {
      const responseJson = await response.json();
      responseText = JSON.stringify(responseJson, null, 2);
    } catch (e) {
      responseText = await response.text();
    }
    
    // Verificar o status da resposta
    console.log(`\n📥 Resposta: [${response.status}] ${response.statusText}`);
    console.log(responseText);
    
    if (response.status === 200) {
      console.log('\n✅ SUCESSO! O webhook está funcionando corretamente.');
      console.log('✅ A solução com verify_jwt = false foi aplicada com sucesso.');
      console.log('\n🔍 Verifique no Supabase se o usuário foi criado com o email:', email);
      console.log('   Se o usuário não foi criado, verifique os logs da função Edge no Supabase.');
      
      return true;
    } else {
      console.log('\n❌ FALHA! O webhook retornou um status diferente de 200.');
      console.log('❌ Verifique se a função Edge foi atualizada e implantada corretamente.');
      console.log('❌ Certifique-se que config.toml tem [functions.stripe-webhook] verify_jwt = false');
      
      return false;
    }
  } catch (error) {
    console.error(`\n❌ ERRO: ${error.message}`);
    return false;
  }
}

// Executar o teste
testWebhook().then(success => {
  console.log('\n======================================================');
  if (success) {
    console.log('✨ Teste concluído com sucesso!');
    console.log('🎉 O webhook do Stripe está configurado corretamente com verify_jwt = false.');
    console.log('💡 Não é mais necessário adicionar cabeçalhos personalizados no Stripe.');
  } else {
    console.log('❗ O teste falhou.');
    console.log('🔧 Verifique se:');
    console.log('  1. O arquivo config.toml está configurado corretamente');
    console.log('  2. A função foi reimplantada após as alterações');
    console.log('  3. O WEBHOOK_SECRET está correto nas variáveis de ambiente do Supabase');
  }
  console.log('======================================================');
}); 