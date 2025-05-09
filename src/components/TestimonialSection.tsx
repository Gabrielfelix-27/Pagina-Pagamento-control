import React from 'react';

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  image: string;
}

const TestimonialSection: React.FC = () => {
  const testimonials: Testimonial[] = [
    {
      name: 'Carlos Silva',
      role: 'Motorista Uber',
      quote: 'Depois que comecei a usar o Drc, consegui aumentar meus ganhos em 25% no primeiro mês. Agora sei exatamente quanto estou ganhando e onde posso melhorar.',
      image: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600'
    },
    {
      name: 'Ana Rodrigues',
      role: 'Motorista 99',
      quote: 'O Drc revolucionou como controlo minhas finanças. Consigo definir metas realistas e acompanhar meu progresso diariamente. Recomendo a todos os motoristas!',
      image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600'
    },
    {
      name: 'Lucas Mendes',
      role: 'Motorista Uber e 99',
      quote: 'Com o rastreamento de quilometragem e a calculadora de renda líquida, finalmente entendo quanto realmente estou ganhando por hora. Foi um divisor de águas para mim.',
      image: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600'
    }
  ];

  return (
    <section id="depoimentos" className="py-20 bg-gradient-to-b from-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            O Que Dizem <span className="text-lime-400">Nossos Usuários</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Centenas de motoristas já transformaram suas finanças com nossa plataforma.
            Veja o que eles têm a dizer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-gray-800 p-8 rounded-xl border border-gray-700 transition-all hover:border-lime-500"
            >
              <div className="flex items-center mb-6">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-16 h-16 rounded-full object-cover mr-4"
                />
                <div>
                  <h3 className="font-bold text-lg">{testimonial.name}</h3>
                  <p className="text-gray-400 text-sm">{testimonial.role}</p>
                </div>
              </div>
              <p className="text-gray-300 italic">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="mt-6 flex">
                <div className="flex text-lime-400">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 fill-current"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialSection;