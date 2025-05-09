import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs: FAQItem[] = [
    {
      question: 'Como o Drc vai me ajudar a ganhar mais como motorista?',
      answer: 'O Drc ajuda você a visualizar claramente seus ganhos, identificar os melhores horários e regiões para trabalhar, e definir metas realistas. Com relatórios detalhados, você pode otimizar suas estratégias de trabalho, reduzir custos desnecessários e maximizar sua renda líquida.'
    },
    {
      question: 'Preciso fornecer acesso às minhas contas nos aplicativos?',
      answer: 'Não. O Drc funciona de forma independente. Você insere manualmente seus ganhos ou importa relatórios dos aplicativos. Não solicitamos acesso direto às suas contas de aplicativos de transporte por motivos de segurança.'
    },
    {
      question: 'Posso cancelar minha assinatura a qualquer momento?',
      answer: 'Sim, você pode cancelar sua assinatura a qualquer momento. Se cancelar, seu acesso continuará ativo até o final do período pago. Não fazemos reembolsos proporcionais para períodos parciais.'
    },
    {
      question: 'O Drc funciona para qualquer aplicativo de transporte?',
      answer: 'Sim, nossa plataforma é compatível com todos os aplicativos de transporte disponíveis no Brasil, incluindo Uber, 99, inDrive e outros. Você pode acompanhar ganhos de múltiplas plataformas simultaneamente.'
    },
    {
      question: 'Como funciona o teste gratuito de 7 dias?',
      answer: 'Ao se inscrever, você terá acesso completo a todos os recursos da plataforma por 7 dias, sem cobranças. Após esse período, será cobrado o valor do plano escolhido, a menos que você cancele antes do término do período de teste.'
    },
    {
      question: 'Que informações são necessárias para criar uma conta?',
      answer: 'Para criar uma conta, você precisa apenas de um e-mail válido e definir uma senha. Durante o checkout, solicitamos informações básicas para faturamento, como nome completo e CPF, conforme exigido pela legislação brasileira.'
    }
  ];

  return (
    <section id="faq" className="py-20 bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Perguntas <span className="text-lime-400">Frequentes</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Tire suas dúvidas sobre o Drc e como ele pode ajudar a maximizar seus ganhos.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="mb-4 border border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                className="w-full py-4 px-6 text-left bg-gray-800 hover:bg-gray-750 flex justify-between items-center transition-colors"
                onClick={() => toggleFAQ(index)}
              >
                <span className="font-medium text-lg">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="text-lime-400" />
                ) : (
                  <ChevronDown className="text-lime-400" />
                )}
              </button>
              {openIndex === index && (
                <div className="py-4 px-6 bg-gray-800 bg-opacity-60 text-gray-300">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;