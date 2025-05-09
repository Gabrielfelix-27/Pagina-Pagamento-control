import React from 'react';
import { 
  Target, 
  DollarSign, 
  BarChart2, 
  Calculator, 
  Map, 
  Clock, 
  FileText, 
  Phone
} from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureSection: React.FC = () => {
  const features: Feature[] = [
    {
      icon: <Target className="w-10 h-10 text-lime-400" />,
      title: 'Definição de Metas',
      description: 'Defina metas de ganhos diárias, semanais e mensais e acompanhe seu progresso em tempo real.'
    },
    {
      icon: <DollarSign className="w-10 h-10 text-lime-400" />,
      title: 'Rastreador de Ganhos',
      description: 'Capture todos os ganhos de múltiplas plataformas em um único painel unificado.'
    },
    {
      icon: <BarChart2 className="w-10 h-10 text-lime-400" />,
      title: 'Gestão de Despesas',
      description: 'Acompanhe combustível, manutenção e outras despesas para entender sua renda líquida real.'
    },
    {
      icon: <Calculator className="w-10 h-10 text-lime-400" />,
      title: 'Calculadora de Renda Líquida',
      description: 'Calcule automaticamente seus ganhos reais após despesas, impostos e depreciação.'
    },
    {
      icon: <Map className="w-10 h-10 text-lime-400" />,
      title: 'Rastreamento de Quilometragem',
      description: 'Acompanhe a distância percorrida e calcule seus ganhos por quilômetro rodado.'
    },
    {
      icon: <Clock className="w-10 h-10 text-lime-400" />,
      title: 'Análise de Tempo de Trabalho',
      description: 'Acompanhe as horas trabalhadas e identifique os períodos mais lucrativos.'
    },
    {
      icon: <FileText className="w-10 h-10 text-lime-400" />,
      title: 'Relatórios Mensais',
      description: 'Relatórios mensais abrangentes para ajudar a otimizar sua estratégia de direção.'
    },
    {
      icon: <Phone className="w-10 h-10 text-lime-400" />,
      title: 'Suporte Prioritário',
      description: 'Acesso a suporte dedicado via chat, email ou telefone para resolver suas dúvidas.'
    }
  ];

  return (
    <section id="recursos" className="py-20 bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Recursos <span className="text-lime-400">Premium</span> para{' '}
            <span className="text-lime-400">Controle Financeiro</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Control fornece tudo o que você precisa para maximizar seus ganhos como
            motorista e assumir o controle do seu futuro financeiro.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 p-8 rounded-xl border border-gray-700 transition-all hover:border-lime-500 hover:translate-y-[-5px]"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;