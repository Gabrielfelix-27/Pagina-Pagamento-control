// Teste da API Stripe via Supabase Edge Functions

async function testStripePrice() {
  try {
    console.log('Testando função Edge de price do Stripe...');
    
    // Token anônimo do projeto Supabase
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b2dmdmZtc290dmVhY2pjY2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQ0MTE1NzEsImV4cCI6MjAyOTk4NzU3MX0.aTsDXdgXqvQAoLzK8Nb6tJHhVmxcD7Isgr5sUuZWULk';
    
    const response = await fetch('https://gyogfvfmsotveacjcckr.supabase.co/functions/v1/test-price', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      }
    });
    
    const data = await response.json();
    console.log('Resposta da função Edge:', data);
    
    if (response.ok) {
      console.log('Teste bem-sucedido!');
    } else {
      console.error('Erro na função Edge:', data.error || 'Erro desconhecido');
    }
  } catch (error) {
    console.error('Erro ao chamar a função Edge:', error);
  }
}

// Executa o teste
testStripePrice(); 