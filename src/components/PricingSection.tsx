import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession } from '../utils/stripeUtils';

interface PlanProps {
  title: string;
  price: string;
  priceId: string;
  stripeLink?: string; // Link direto do Stripe
  popular?: boolean;
  features: string[];
  duration: string;
  discount?: string;
}

const PricingSection: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const handleSubscribe = async (plan: PlanProps) => {
    try {
      // Reset errors
      setError(null);
      
      // Set loading state for specific plan
      setIsLoading(true);
      setProcessingPlan(plan.priceId);

      // Se tivermos um link direto do Stripe, usamos ele (normalmente não usado)
      if (plan.stripeLink) {
        window.location.href = plan.stripeLink;
        return;
      }

      console.log(`Iniciando checkout para o plano: ${plan.title} (${plan.priceId})`);
      
      // Chamada simplificada para o Stripe Checkout
      const { url } = await createCheckoutSession(plan.priceId);
      
      if (!url) {
        throw new Error('URL de checkout não retornada pelo servidor');
      }

      // Redireciona para a URL do Stripe Checkout
      console.log(`Redirecionando para Stripe: ${url.substring(0, 60)}...`);
      window.location.href = url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao processar o pagamento';
      console.error('Erro ao criar sessão de checkout:', errorMessage);
      setError(errorMessage);
      
      // Exibir o erro por 5 segundos e depois limpar
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setIsLoading(false);
      setProcessingPlan(null);
    }
  };

  // Planos disponíveis
  const plans: PlanProps[] = [
    {
      title: 'Mensal',
      price: 'R$ 13,99',
      priceId: 'price_1RMD9JRwUl4uJKT1zQX7jua7',
      features: [
        'Acesso a todos os relatórios',
        'Suporte por e-mail',
        'Análise de desempenho',
        'Atualizações regulares'
      ],
      duration: 'por mês'
    },
    {
      title: 'Trimestral',
      price: 'R$ 39,87',
      priceId: 'price_1RMDA6RwUl4uJKT1a9E6MCyA',
      popular: true,
      features: [
        'Todos os recursos do plano Mensal',
        'Suporte prioritário',
        'Acesso a recursos exclusivos',
        'Alertas personalizados'
      ],
      duration: 'por trimestre',
      discount: 'Economize 5%'
    },
    {
      title: 'Semestral',
      price: 'R$ 79,74',
      priceId: 'price_1RMDAhRwUl4uJKT1ZPMwEibp',
      features: [
        'Todos os recursos do plano Trimestral',
        'Suporte por telefone',
        'Relatórios avançados',
        'Exportação de dados ilimitada'
      ],
      duration: 'por semestre',
      discount: 'Economize 5%'
    },
    {
      title: 'Anual',
      price: 'R$ 159,48',
      priceId: 'price_1RMDBARwUl4uJKT1rzUe9Jay',
      features: [
        'Todos os recursos do plano Semestral',
        'Consultoria personalizada',
        'Acesso antecipado a novos recursos',
        'Plano completamente customizável'
      ],
      duration: 'por ano',
      discount: 'Economize 5%'
    }
  ];

  return (
    <section className="bg-white py-16" id="planos">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Escolha o plano ideal para você</h2>
          <p className="text-lg text-gray-600">
            Oferecemos diferentes opções para atender às suas necessidades e orçamento.
          </p>
          
          {/* Exibição de erro global */}
          {error && (
            <div className="mt-6 py-3 px-4 bg-red-100 border border-red-300 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan.priceId} 
              className={`border rounded-xl p-6 flex flex-col h-full transition-all shadow hover:shadow-lg ${
                plan.popular ? 'border-blue-500 relative' : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 bg-blue-500 text-white text-xs font-bold py-1 px-3 rounded-full">
                  Mais popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold">{plan.title}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 ml-1">{plan.duration}</span>
                </div>
                {plan.discount && (
                  <div className="mt-1 text-green-600 font-medium">
                    {plan.discount}
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="text-green-500 h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-md font-medium transition-colors focus:outline-none ${
                  plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                } ${isLoading && processingPlan === plan.priceId ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading && processingPlan === plan.priceId ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                  </span>
                ) : (
                  'Assinar Agora'
                )}
              </button>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-10 text-gray-500 text-sm">
          <p>Todos os planos incluem acesso completo à plataforma. Pagamento seguro via Stripe.</p>
          <p className="mt-1">Cancelamento disponível a qualquer momento sem multa.</p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;