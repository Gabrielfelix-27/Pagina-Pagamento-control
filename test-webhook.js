// Script para testar o webhook do Stripe diretamente
import fetch from 'node-fetch';

// Configurações
const WEBHOOK_URL = 'https://gyogfvfmsotveacjcckr.supabase.co/functions/v1/stripe-webhook';
const WEBHOOK_SECRET = 'whsec_K9dbfeAvmkjvZzZjkealUjIjEcCR9Tot';

// Função para gerar IDs de teste com timestamp
function generateTestId(prefix) {
  return `${prefix}_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Função para gerar uma assinatura no formato que o Stripe espera
function generateStripeSignature() {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `v1=dummy_signature_${Date.now()}`;
  return `t=${timestamp},${signature}`;
}

// Teste para payment_intent.succeeded
async function testPaymentIntentSucceeded() {
  console.log('\n📡 Testando evento: payment_intent.succeeded\n');
  
  const customerId = generateTestId('cus');
  const paymentIntentId = generateTestId('pi');
  const email = `test_${Date.now()}@example.com`;
  
  const eventData = {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: paymentIntentId,
        object: 'payment_intent',
        amount: 2000,
        currency: 'brl',
        status: 'succeeded',
        customer: customerId,
        receipt_email: email,
        metadata: {
          email: email,
          name: 'Usuário de Teste'
        },
        created: Math.floor(Date.now() / 1000),
        payment_method_types: ['card'],
        payment_method: 'pm_test_card',
        charges: {
          data: [{
            id: generateTestId('ch'),
            status: 'succeeded',
            amount: 2000
          }]
        }
      }
    }
  };
  
  console.log(`🔹 ID do PaymentIntent: ${paymentIntentId}`);
  console.log(`🔹 ID do Customer: ${customerId}`);
  console.log(`🔹 Email: ${email}`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(eventData)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
    
    console.log(`\n✅ Status: ${response.status} ${response.statusText}`);
    console.log(`✅ Resposta:`, result);
    
    if (response.status === 200) {
      console.log('\n✅ TESTE BEM-SUCEDIDO: evento payment_intent.succeeded processado');
      console.log('✅ Usuário possivelmente criado com email:', email);
    } else {
      console.log('\n❌ FALHA: O servidor não retornou status 200');
    }
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
}

// Teste para checkout.session.completed
async function testCheckoutSessionCompleted() {
  console.log('\n📡 Testando evento: checkout.session.completed\n');
  
  const customerId = generateTestId('cus');
  const sessionId = generateTestId('cs');
  const email = `test_${Date.now()}@example.com`;
  
  const eventData = {
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
        client_reference_id: generateTestId('ref'),
        metadata: {
          plan: 'premium',
          user_name: 'Usuário de Teste Checkout'
        },
        amount_total: 2000,
        currency: 'brl'
      }
    }
  };
  
  console.log(`🔹 ID da Sessão: ${sessionId}`);
  console.log(`🔹 ID do Customer: ${customerId}`);
  console.log(`🔹 Email: ${email}`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(eventData)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
    
    console.log(`\n✅ Status: ${response.status} ${response.statusText}`);
    console.log(`✅ Resposta:`, result);
    
    if (response.status === 200) {
      console.log('\n✅ TESTE BEM-SUCEDIDO: evento checkout.session.completed processado');
      console.log('✅ Usuário possivelmente criado com email:', email);
    } else {
      console.log('\n❌ FALHA: O servidor não retornou status 200');
    }
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
}

// Função principal para executar os testes
async function runTests() {
  console.log('🔄 INICIANDO TESTES DO WEBHOOK STRIPE');
  console.log('====================================');
  console.log(`🌐 URL: ${WEBHOOK_URL}`);
  console.log(`🔑 Usando apenas o cabeçalho x-webhook-secret para autenticação`);
  
  // Primeiro teste: PaymentIntent
  await testPaymentIntentSucceeded();
  
  // Aguardar um momento entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Segundo teste: Checkout Session
  await testCheckoutSessionCompleted();
  
  console.log('\n====================================');
  console.log('✨ TESTES CONCLUÍDOS');
  console.log('🔍 Verifique os logs no Supabase para confirmar se os eventos foram processados corretamente');
  console.log('👤 Verifique o banco de dados para confirmar se os usuários foram criados');
}

// Executar os testes
runTests().catch(error => {
  console.error('❌ ERRO FATAL:', error);
  process.exit(1);
}); 