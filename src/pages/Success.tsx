import React, { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

const Success: React.FC = () => {
  useEffect(() => {
    // Redirecionar para o site principal após 5 segundos
    const timer = setTimeout(() => {
      window.location.href = 'https://www.driverincontrol.com.br';
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={64} className="text-lime-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-6">
          Pagamento Confirmado!
        </h1>
        
        <p className="text-gray-300 mb-8">
          Seu pagamento foi processado com sucesso! Enviamos um e-mail com suas credenciais de acesso.
        </p>
        
        <p className="text-gray-400 text-sm">
          Redirecionando para o site principal em 5 segundos...
        </p>
      </div>
    </div>
  );
};

export default Success; 