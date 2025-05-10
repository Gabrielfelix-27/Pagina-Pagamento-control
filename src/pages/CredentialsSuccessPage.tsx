import React, { useEffect, useState } from 'react';
import { Printer, Copy, Check, ArrowRight, AlertCircle } from 'lucide-react';

const CredentialsSuccessPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('');
  const [userExists, setUserExists] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Parse URL parameters on component mount
    const params = new URLSearchParams(window.location.search);
    
    // Check if user already exists
    if (params.get('user_already_exists') === 'true') {
      setUserExists(true);
      setUserEmail(params.get('email') || '');
      setLoading(false);
    } 
    // Check if new credentials are present
    else if (params.get('credentials') === 'true') {
      setUserEmail(params.get('email') || '');
      setUserPassword(params.get('password') || '');
      setLoading(false);
    } 
    // No valid parameters found
    else {
      setLoading(false);
    }
  }, []);

  // Handle copying text to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopyStatus({ ...copyStatus, [field]: true });
        setTimeout(() => {
          setCopyStatus({ ...copyStatus, [field]: false });
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Navigate to application
  const goToApp = () => {
    window.location.href = 'https://app.drcfinancas.com.br/login';
  };

  // Handle printing credentials
  const printCredentials = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
        <div className="p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            Pagamento Confirmado!
          </h1>
          
          <p className="text-gray-600 text-center mb-8">
            Obrigado pela sua compra. Seu pagamento foi processado com sucesso.
          </p>

          {loading && (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Carregando informações de acesso...</p>
            </div>
          )}

          {!loading && userExists && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-blue-800 mb-3">Você já possui uma conta</h2>
              <p className="text-gray-600 mb-3">Você já possui uma conta associada ao email:</p>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 relative mb-4">
                <span className="block text-sm font-medium text-gray-700 mb-1">Email:</span>
                <div className="text-gray-900 font-mono bg-gray-50 p-2 rounded">
                  {userEmail}
                </div>
                <button 
                  onClick={() => copyToClipboard(userEmail, 'email')}
                  className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                >
                  {copyStatus['email'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              
              <p className="text-gray-600">Use sua senha atual para fazer login.</p>
            </div>
          )}

          {!loading && !userExists && userEmail && userPassword && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-green-800 mb-3">Suas Credenciais de Acesso</h2>
              
              <div className="flex items-center space-x-2 bg-yellow-50 p-3 rounded-lg mb-4">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <p className="text-yellow-700 font-medium text-sm">IMPORTANTE: Salve estas informações!</p>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 relative mb-4">
                <span className="block text-sm font-medium text-gray-700 mb-1">Email:</span>
                <div className="text-gray-900 font-mono bg-gray-50 p-2 rounded">
                  {userEmail}
                </div>
                <button 
                  onClick={() => copyToClipboard(userEmail, 'email')}
                  className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                >
                  {copyStatus['email'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 relative mb-4">
                <span className="block text-sm font-medium text-gray-700 mb-1">Senha:</span>
                <div className="text-gray-900 font-mono bg-gray-50 p-2 rounded">
                  {userPassword}
                </div>
                <button 
                  onClick={() => copyToClipboard(userPassword, 'password')}
                  className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                >
                  {copyStatus['password'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              
              <p className="text-gray-600 text-sm mb-2">
                Um email de backup com estas credenciais também foi enviado para você.
              </p>
              
              <p className="text-red-600 text-sm italic">
                Por segurança, recomendamos alterar sua senha após o primeiro acesso.
              </p>
            </div>
          )}

          {!loading && !userExists && (!userEmail || !userPassword) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
              <div className="flex items-center mb-4">
                <AlertCircle className="h-6 w-6 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold text-yellow-800">Informações não encontradas</h2>
              </div>
              <p className="text-gray-600">
                Não foi possível carregar as informações de acesso. Um email com suas credenciais 
                foi enviado para o endereço fornecido durante a compra.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            {(userEmail && userPassword && !userExists) && (
              <button
                onClick={printCredentials}
                className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded-md transition flex-1"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </button>
            )}
            
            <button
              onClick={goToApp}
              className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-md transition flex-1"
            >
              Ir para a Aplicação
              <ArrowRight className="h-4 w-4 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CredentialsSuccessPage; 