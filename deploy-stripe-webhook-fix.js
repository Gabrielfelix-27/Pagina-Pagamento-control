// Script para testar o webhook do Stripe com eventos mais realistas
import fetch from 'node-fetch';

// Configurações
const WEBHOOK_URL = 'https://gyogfvfmsotveacjcckr.supabase.co/functions/v1/stripe-webhook';
const WEBHOOK_SECRET = 'whsec_K9dbfeAvmkjvZzZjkealUjIjEcCR9Tot';

// Função para gerar IDs de teste com timestamp
function generateTestId(prefix) {
  return `${prefix}_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Teste com stripe-signature e x-webhook-secret
async function testWithBothHeaders() {
  console.log('\n📡 Testando com ambos os cabeçalhos: stripe-signature e x-webhook-secret\n');
  
  const customerId = generateTestId('cus');
  const paymentIntentId = generateTestId('pi');
  const email = `test_dual_${Date.now()}@example.com`;
  
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
        created: Math.floor(Date.now() / 1000)
      }
    }
  };
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
        'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=dummy_signature_${Date.now()}`
      },
      body: JSON.stringify(eventData)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`✅ Resposta:`, result);
    
    return response.status === 200;
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    return false;
  }
}

// Teste apenas com x-webhook-secret
async function testWithOnlyWebhookSecret() {
  console.log('\n📡 Testando com apenas x-webhook-secret\n');
  
  const customerId = generateTestId('cus');
  const paymentIntentId = generateTestId('pi');
  const email = `test_secret_${Date.now()}@example.com`;
  
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
        created: Math.floor(Date.now() / 1000)
      }
    }
  };
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(eventData)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`✅ Resposta:`, result);
    
    return response.status === 200;
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    return false;
  }
}

// Teste apenas com stripe-signature
async function testWithOnlyStripeSignature() {
  console.log('\n📡 Testando com apenas stripe-signature\n');
  
  const customerId = generateTestId('cus');
  const paymentIntentId = generateTestId('pi');
  const email = `test_signature_${Date.now()}@example.com`;
  
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
        created: Math.floor(Date.now() / 1000)
      }
    }
  };
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=dummy_signature_${Date.now()}`
      },
      body: JSON.stringify(eventData)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`✅ Resposta:`, result);
    
    return response.status === 200;
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    return false;
  }
}

// Teste sem nenhum cabeçalho de segurança
async function testWithNoSecurityHeaders() {
  console.log('\n📡 Testando sem cabeçalhos de segurança\n');
  
  const customerId = generateTestId('cus');
  const paymentIntentId = generateTestId('pi');
  const email = `test_nosecurity_${Date.now()}@example.com`;
  
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
        created: Math.floor(Date.now() / 1000)
      }
    }
  };
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`✅ Resposta:`, result);
    
    return response.status === 200;
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    return false;
  }
}

// Função principal para executar os testes
async function runTests() {
  console.log('🔄 TESTES DE SEGURANÇA DO WEBHOOK STRIPE');
  console.log('=========================================');
  console.log(`🌐 URL: ${WEBHOOK_URL}`);
  
  // Executar os testes
  const results = {
    bothHeaders: await testWithBothHeaders(),
    onlyWebhookSecret: await testWithOnlyWebhookSecret(),
    onlyStripeSignature: await testWithOnlyStripeSignature(),
    noSecurityHeaders: await testWithNoSecurityHeaders()
  };
  
  // Exibir resumo
  console.log('\n=========================================');
  console.log('📊 RESUMO DOS TESTES');
  console.log('=========================================');
  console.log(`✅ Ambos os cabeçalhos: ${results.bothHeaders ? 'SUCESSO' : 'FALHA'}`);
  console.log(`✅ Apenas x-webhook-secret: ${results.onlyWebhookSecret ? 'SUCESSO' : 'FALHA'}`);
  console.log(`✅ Apenas stripe-signature: ${results.onlyStripeSignature ? 'SUCESSO' : 'FALHA'}`);
  console.log(`✅ Sem cabeçalhos de segurança: ${results.noSecurityHeaders ? 'SUCESSO' : 'FALHA'}`);
  
  console.log('\n=========================================');
  if (results.onlyWebhookSecret) {
    console.log('✅ A solução para o problema do SubtleCryptoProvider está funcionando!');
    console.log('✅ O webhook está aceitando requisições autenticadas com x-webhook-secret');
  } else {
    console.log('❌ A solução ainda não está funcionando corretamente.');
    console.log('❌ É necessário implantar a versão atualizada da função Edge.');
  }
}

// Executar os testes
runTests().catch(error => {
  console.error('❌ ERRO FATAL:', error);
  process.exit(1);
}); 