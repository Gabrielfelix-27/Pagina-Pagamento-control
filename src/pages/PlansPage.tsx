import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
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

const PlansPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubscribe = async (plan: PlanProps) => {
    try {
      setError(null);
      setIsLoading(true);

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
    } finally {
      setIsLoading(false);
    }
  };

  const plans: PlanProps[] = [
    {
      title: 'Plano Mensal',
      price: 'R$13,99',
      priceId: 'price_1RMD9JRwUl4uJKT1zQX7jua7',
      features: [
        'Painel de ganhos em tempo real',
        'Definição básica de metas',
        'Relatórios semanais de desempenho',
        'Visualização do progresso das metas e projeções',
        'Suporte prioritário'
      ],
      duration: '1 mês de utilização'
    },
    {
      title: 'Plano Trimestral',
      price: 'R$39,87',
      priceId: 'price_1RMDA6RwUl4uJKT1a9E6MCyA',
      popular: true,
      features: [
        'Painel de ganhos em tempo real',
        'Definição básica de metas',
        'Relatórios semanais de desempenho',
        'Visualização do progresso das metas e projeções',
        'Suporte prioritário'
      ],
      discount: 'ECONOMIA DE 5%',
      duration: '3 meses de utilização'
    },
    {
      title: 'Plano Semestral',
      price: 'R$79,74',
      priceId: 'price_1RMDAhRwUl4uJKT1ZPMwEibp',
      features: [
        'Painel de ganhos em tempo real',
        'Definição básica de metas',
        'Relatórios semanais de desempenho',
        'Visualização do progresso das metas e projeções',
        'Suporte prioritário'
      ],
      discount: 'ECONOMIA DE 5%',
      duration: '6 meses de utilização'
    },
    {
      title: 'Plano Anual',
      price: 'R$159,48',
      priceId: 'price_1RMDBARwUl4uJKT1rzUe9Jay',
      features: [
        'Painel de ganhos em tempo real',
        'Definição básica de metas',
        'Relatórios semanais de desempenho',
        'Visualização do progresso das metas e projeções',
        'Suporte prioritário'
      ],
      discount: 'ECONOMIA DE 5%',
      duration: '12 meses de utilização'
    }
  ];

  return (
    <section className="pt-32 pb-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-6">
            Escolha o <span className="text-lime-400">Plano</span> Ideal para Você
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Todos os planos incluem acesso completo a todas as funcionalidades.
            Escolha o período que melhor se adapta às suas necessidades.
          </p>
          {error && (
            <div className="mt-4 p-4 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-500">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-gray-800 rounded-xl overflow-hidden border ${
                plan.popular ? 'border-lime-500' : 'border-gray-700'
              } relative transition-transform hover:translate-y-[-10px]`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 left-0 bg-lime-500 text-center py-1 text-black font-bold text-sm">
                  MAIS POPULAR
                </div>
              )}
              <div className="p-8">
                <h3 className="text-xl font-bold mb-4">{plan.title}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                </div>
                {plan.discount && (
                  <div className="bg-lime-500 text-black text-xs font-bold py-1 px-3 rounded-full inline-block mb-4">
                    {plan.discount}
                  </div>
                )}
                <div className="bg-gray-700 bg-opacity-50 py-2 px-4 rounded-lg text-sm mb-6">
                  {plan.duration}
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-lime-400 mr-2 mt-1">
                        <Check size={18} />
                      </span>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading}
                  className={`w-full py-3 px-6 rounded-lg font-bold transition-colors ${
                    plan.popular
                      ? 'bg-lime-500 hover:bg-lime-400 text-black'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Processando...' : 'Começar Agora'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-6">Perguntas Frequentes sobre Nossos Planos</h2>
          
          <div className="bg-gray-800 rounded-xl p-6 mb-6 text-left">
            <h3 className="text-lg font-semibold mb-2">Como funciona o teste gratuito?</h3>
            <p className="text-gray-300">
              Todos os planos incluem um teste gratuito de 7 dias. Você pode experimentar todos os 
              recursos da plataforma sem compromisso. Cancelamento fácil a qualquer momento.
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 mb-6 text-left">
            <h3 className="text-lg font-semibold mb-2">Posso mudar de plano depois?</h3>
            <p className="text-gray-300">
              Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento. 
              As mudanças entram em vigor no próximo ciclo de faturamento.
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 text-left">
            <h3 className="text-lg font-semibold mb-2">Como funciona o pagamento?</h3>
            <p className="text-gray-300">
              Processamos pagamentos de forma segura através do Stripe. Aceitamos todos os 
              principais cartões de crédito. Seus dados de pagamento são criptografados e armazenados
              com segurança.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlansPage;