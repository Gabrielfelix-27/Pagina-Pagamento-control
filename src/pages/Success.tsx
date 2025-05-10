import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

const Success: React.FC = () => {
  // Estado para controlar se já tentamos redirecionar
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  // Estado para mensagens de debug
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    console.log('Success page loaded, checking for parameters...');
    
    // Verificar se há parâmetros de email e senha na URL
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const passwordParam = params.get('password');
    
    // Coleta informações de debug
    const debugData = {
      hasEmail: !!emailParam,
      hasPassword: !!passwordParam,
      redirectAttempted,
      params: Object.fromEntries(params.entries()),
      url: window.location.href
    };
    setDebugInfo(JSON.stringify(debugData, null, 2));
    
    // Se temos um email (e possivelmente uma senha), redirecionar para página de credenciais
    if (emailParam && !redirectAttempted) {
      setRedirectAttempted(true);
      
      // Preservar os parâmetros na URL de redirecionamento
      const newUrl = `/payment-confirmation?${params.toString()}`;
      console.log('Redirecionando para página de credenciais:', newUrl);
      window.location.href = newUrl;
      return;
    }

    // Se não há parâmetros de credenciais, seguir com comportamento padrão
    if (!emailParam && !redirectAttempted) {
      // Ajuste adicional: tentar recuperar informações do cliente do Stripe
      // Esta implementação é simplificada - idealmente precisaria de uma função edge
      console.log('Sem parâmetros de email/senha, iniciando timer de redirecionamento');
    }
    
    const timer = setTimeout(() => {
      window.location.href = 'https://www.driverincontrol.com.br';
    }, 5000);

    return () => clearTimeout(timer);
  }, [redirectAttempted]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={64} className="text-lime-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-6 text-white">
          Pagamento Confirmado!
        </h1>
        
        <p className="text-gray-300 mb-8">
          Seu pagamento foi processado com sucesso! Enviamos um e-mail com suas credenciais de acesso.
        </p>
        
        <p className="text-gray-400 text-sm">
          Redirecionando para o site principal em 5 segundos...
        </p>
        
        {/* Debug info - remover em produção */}
        {debugInfo && (
          <div className="mt-8 p-3 bg-gray-900 rounded-lg border border-gray-700 overflow-auto max-h-40 text-xs text-gray-400 font-mono no-print">
            <p className="text-yellow-500 mb-1">Debug info:</p>
            <pre>{debugInfo}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Success; 