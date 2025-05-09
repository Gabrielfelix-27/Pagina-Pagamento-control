import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, Clock } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="pt-28 pb-16 md:pt-40 md:pb-24 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-gray-900 to-black"></div>
      
      {/* Background effect */}
      <div className="absolute top-40 left-0 w-full h-full z-0 opacity-20">
        <div className="absolute w-72 h-72 bg-lime-500 rounded-full blur-3xl -top-10 -left-10"></div>
        <div className="absolute w-96 h-96 bg-blue-600 rounded-full blur-3xl -bottom-20 -right-20"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-lime-400">Assuma o Controle</span> dos seus<br />
            Ganhos como Motorista<br />
            <span className="text-lime-400">De Aplicativo</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto">
            A plataforma premium de controle financeiro projetada exclusivamente
            para motoristas de aplicativo. Acompanhe seus ganhos, defina metas e
            maximize seus lucros.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 justify-center mb-16">
            <Link
              to="/plans"
              className="bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105"
            >
              Ver Planos e Preços
            </Link>
            <a
              href="#recursos"
              className="bg-transparent border-2 border-gray-600 hover:border-lime-500 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all"
            >
              Conheça os Recursos
            </a>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="bg-gray-800 bg-opacity-50 p-6 rounded-xl backdrop-blur-sm border border-gray-700">
              <div className="mb-4 text-lime-400 flex justify-center">
                <BarChart3 size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Rastreie seus Ganhos</h3>
              <p className="text-gray-300">
                Acompanhe seus ganhos em todas as plataformas em um único painel.
              </p>
            </div>
            
            <div className="bg-gray-800 bg-opacity-50 p-6 rounded-xl backdrop-blur-sm border border-gray-700">
              <div className="mb-4 text-lime-400 flex justify-center">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Defina Metas Claras</h3>
              <p className="text-gray-300">
                Estabeleça metas diárias, semanais e mensais para maximizar sua renda.
              </p>
            </div>
            
            <div className="bg-gray-800 bg-opacity-50 p-6 rounded-xl backdrop-blur-sm border border-gray-700">
              <div className="mb-4 text-lime-400 flex justify-center">
                <Clock size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Otimize seu Tempo</h3>
              <p className="text-gray-300">
                Identifique os melhores horários e regiões para maximizar seus ganhos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;