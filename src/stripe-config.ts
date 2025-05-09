export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  mode: 'subscription';
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_SGkgjSyyyxtMfi',
    priceId: 'price_1RMDBARwUl4uJKT1rzUe9Jay',
    name: 'Control Anual',
    description: 'Controle Anual',
    price: 159.48,
    mode: 'subscription'
  },
  {
    id: 'prod_SGkgdV58Sqvwia',
    priceId: 'price_1RMDAhRwUl4uJKT1ZPMwEibp',
    name: 'Control Semestral',
    description: 'Controle Semestral',
    price: 79.74,
    mode: 'subscription'
  },
  {
    id: 'prod_SGkfmPIIdGyrKu',
    priceId: 'price_1RMDA6RwUl4uJKT1a9E6MCyA',
    name: 'Control Trimestral',
    description: 'Controle Trimestral',
    price: 39.87,
    mode: 'subscription'
  },
  {
    id: 'prod_SGkeHmUDwYFOjR',
    priceId: 'price_1RMD9JRwUl4uJKT1zQX7jua7',
    name: 'Control Mensal',
    description: 'Controle Mensal',
    price: 13.99,
    mode: 'subscription'
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);
};