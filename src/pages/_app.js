import '../styles/globals.css';
import { useEffect } from 'react';
import EnforceDefaultPassword from '../components/EnforceDefaultPassword';

function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Componente invisível que garante que todas as senhas sejam 123456 */}
      <EnforceDefaultPassword />
      
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 