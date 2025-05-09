import React from 'react';
import { Link } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';

const CheckoutCancel: React.FC = () => {
  return (
    <div className="pt-32 pb-20 min-h-screen bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-8 border border-gray-700">
          <div className="flex justify-center mb-6">
            <XCircle size={64} className="text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-6">
            Pagamento Cancelado
          </h1>
          
          <p className="text-gray-300 mb-8 text-center">
            O processo de pagamento foi cancelado. Nenhuma cobrança foi realizada.
          </p>
          
          <div className="bg-gray-700 p-6 rounded-lg mb-8">
            <h3 className="font-medium mb-4">Algumas razões comuns para cancelamentos:</h3>
            <ul className="space-y-2 text-gray-300 list-disc pl-5">
              <li>Problemas com o cartão de crédito</li>
              <li>Decisão de escolher outro plano</li>
              <li>Necessidade de mais informações antes de assinar</li>
              <li>Problemas técnicos temporários</li>
            </ul>
          </div>
          
          <div className="text-center">
            <Link
              to="/plans"
              className="bg-lime-500 hover:bg-lime-400 text-black font-bold py-3 px-8 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft size={18} /> Voltar para os Planos
            </Link>
            
            <p className="mt-6 text-gray-400 text-sm">
              Precisa de ajuda? Entre em contato com nosso suporte via 
              <a href="mailto:suporte@drcfinancas.com.br" className="text-lime-400 hover:underline ml-1">
                suporte@drcfinancas.com.br
              </a>
            </p>
            
            <Link to="/" className="text-lime-400 hover:underline block mt-4">
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCancel;