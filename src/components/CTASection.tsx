import React from 'react';
import { Link } from 'react-router-dom';

const CTASection: React.FC = () => {
  return (
    <section className="py-20 bg-black relative overflow-hidden">
      {/* Background effect */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-96 h-96 bg-lime-500 rounded-full blur-3xl opacity-20 -top-20 -right-20"></div>
        <div className="absolute w-72 h-72 bg-blue-600 rounded-full blur-3xl opacity-10 -bottom-10 -left-10"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-8">
            Pronto para <span className="text-lime-400">Maximizar</span> seus Ganhos?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Junte-se a centenas de motoristas que já transformaram sua relação com dinheiro.
            Comece hoje mesmo e veja a diferença em seus ganhos nos próximos 30 dias.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              to="/plans"
              className="bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold py-4 px-10 rounded-lg text-lg transition-all transform hover:scale-105"
            >
              Começar Agora
            </Link>
            <a
              href="#recursos"
              className="text-gray-300 hover:text-lime-400 font-medium transition-colors"
            >
              Conheça mais recursos →
            </a>
          </div>
          
          <div className="mt-16 border-t border-gray-800 pt-10">
            <p className="text-gray-400 mb-6">
              Confiado por motoristas de todo o Brasil
            </p>
            <div className="flex flex-wrap justify-center gap-4 items-center">
              <div className="bg-gray-800 py-2 px-5 rounded-full">
                <span className="text-lime-400 font-bold">650+</span>
                <span className="text-gray-400 ml-2">Usuários Ativos</span>
              </div>
              <div className="bg-gray-800 py-2 px-5 rounded-full">
                <span className="text-lime-400 font-bold">4.8/5</span>
                <span className="text-gray-400 ml-2">Avaliação Média</span>
              </div>
              <div className="bg-gray-800 py-2 px-5 rounded-full">
                <span className="text-lime-400 font-bold">30%</span>
                <span className="text-gray-400 ml-2">Aumento Médio nos Ganhos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;