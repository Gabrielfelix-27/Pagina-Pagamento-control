import React, { useState, useEffect } from 'react';
import { CheckCircle, Copy, Check, AlertCircle, Save, Download, Loader } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const PaymentConfirmation: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [savedCredentials, setSavedCredentials] = useState<boolean>(false);
  const [debug, setDebug] = useState<string>('');
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Função para recuperar credenciais via API
  const recoverCredentials = async (sessionId: string) => {
    try {
      console.log('Tentando recuperar credenciais para a sessão:', sessionId);
      
      const { data, error } = await supabase.functions.invoke('get-payment-credentials', {
        body: { payment_id: sessionId }
      });
      
      if (error) {
        console.error('Erro ao recuperar credenciais:', error);
        setRecoveryError(`Falha ao recuperar credenciais: ${error.message}`);
        return false;
      }
      
      if (data && data.success && data.data) {
        console.log('Credenciais recuperadas com sucesso!', data.source);
        
        if (data.data.email) {
          setUserEmail(data.data.email);
        }
        
        if (data.data.password) {
          setUserPassword(data.data.password);
        }
        
        setDebug(prev => `${prev}\n\nCredenciais recuperadas via API (${data.source}):\n${JSON.stringify(data.data, null, 2)}`);
        return true;
      } else {
        console.warn('API retornou sem erro, mas sem dados válidos:', data);
        setRecoveryError('Não foi possível recuperar as credenciais (dados inválidos)');
        return false;
      }
    } catch (err) {
      console.error('Exceção ao recuperar credenciais:', err);
      setRecoveryError(`Erro ao recuperar credenciais: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      return false;
    }
  };

  useEffect(() => {
    try {
      setLoading(true);
      
      // Parse URL parameters on component mount
      const params = new URLSearchParams(window.location.search);
      
      // Log detalhado dos parâmetros para depuração
      const paramsObj = Object.fromEntries(params.entries());
      console.log('Parâmetros recebidos na PaymentConfirmation:', paramsObj);
      setDebug(JSON.stringify(paramsObj, null, 2));
      
      // Obter diretamente os parâmetros da URL
      const emailParam = params.get('email');
      const passwordParam = params.get('password');
      const sessionIdParam = params.get('session_id'); // ID de sessão do Stripe
      const paymentIdParam = params.get('payment_intent') || params.get('payment_intent_id'); // ID do PaymentIntent
      
      // Flag para indicar se precisamos tentar recuperação
      let needsRecovery = false;
      
      if (emailParam) {
        console.log('Email encontrado:', emailParam);
        setUserEmail(emailParam);
      } else {
        console.log('Email não encontrado nos parâmetros');
        needsRecovery = true;
      }
      
      if (passwordParam) {
        console.log('Senha encontrada:', passwordParam);
        setUserPassword(passwordParam);
      } else {
        console.log('Senha não encontrada nos parâmetros');
        // Note: não definimos needsRecovery=true aqui porque o usuário pode já existir
      }
      
      // Se faltam dados e temos um ID de sessão/pagamento, tentamos recuperar
      if ((needsRecovery || !passwordParam) && (sessionIdParam || paymentIdParam) && !recoveryAttempted) {
        setRecoveryAttempted(true);
        console.log('Tentando recuperar credenciais...');
        
        // Tentar com um dos IDs disponíveis
        const recoveryId = sessionIdParam || paymentIdParam;
        
        // Iniciar processo assíncrono para recuperar
        if (recoveryId) {
          recoverCredentials(recoveryId).then(success => {
            console.log('Recuperação de credenciais:', success ? 'bem-sucedida' : 'falhou');
            setLoading(false);
          });
        } else {
          console.log('Nenhum ID disponível para recuperação');
          setLoading(false);
        }
      } else {
        // Se temos todos os dados necessários ou já tentamos recuperar
        setLoading(false);
      }
    } catch (error) {
      console.error('Erro ao processar parâmetros da URL:', error);
      setLoading(false);
    }
  }, [recoveryAttempted]);

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

  // Handle printing credentials
  const printCredentials = () => {
    window.print();
    setSavedCredentials(true);
  };

  // Handle downloading credentials as text file
  const downloadCredentials = () => {
    const credentialsText = `
CREDENCIAIS DE ACESSO - NÃO COMPARTILHE
---------------------------------------
Email: ${userEmail}
Senha: ${userPassword}
---------------------------------------
IMPORTANTE: Guarde estas informações em local seguro.
Você precisará desta senha para acessar o sistema.
    `;

    const blob = new Blob([credentialsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minhas-credenciais.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setSavedCredentials(true);
  };

  // Determinar se temos credenciais completas ou apenas email
  const hasFullCredentials = userEmail && userPassword;
  const hasOnlyEmail = userEmail && !userPassword;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <Loader className="animate-spin h-12 w-12 text-lime-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Recuperando suas credenciais...</h2>
          <p className="text-gray-400">Por favor, aguarde enquanto processamos suas informações de acesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 border border-gray-700">
        <div className="flex justify-center mb-6 no-print">
          <CheckCircle size={64} className="text-lime-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-6 text-white no-print">
          Pagamento Confirmado!
        </h1>
        
        <p className="text-gray-300 mb-8 text-center no-print">
          Seu pagamento foi processado com sucesso! {hasFullCredentials && 'Confira abaixo suas credenciais de acesso.'}
        </p>

        <div className="space-y-6">
          {/* Alert Banner - Extremely Important */}
          {hasFullCredentials && (
            <div className={`${savedCredentials ? 'bg-green-900/30 border-green-500/30' : 'bg-red-900/30 border-red-500/30'} border rounded-lg p-4 mb-6 animate-pulse no-print`}>
                <div className="flex items-center space-x-3 mb-3">
                  <AlertCircle className={`h-6 w-6 ${savedCredentials ? 'text-green-500' : 'text-red-500'} flex-shrink-0`} />
                  <p className={`${savedCredentials ? 'text-green-300' : 'text-red-300'} font-bold`}>
                    {savedCredentials ? 'CREDENCIAIS SALVAS!' : 'ATENÇÃO: DADOS DE ACESSO!'}
                  </p>
                </div>
                <p className={`${savedCredentials ? 'text-green-200' : 'text-red-200'} text-sm font-medium`}>
                  {savedCredentials 
                    ? 'Você já salvou suas credenciais. Guarde-as em local seguro.' 
                    : 'Estas são suas ÚNICAS credenciais de acesso ao sistema. Você DEVE salvar esta senha agora, pois precisará dela para fazer login!'}
                </p>
            </div>
          )}

          {/* Erro de recuperação */}
          {recoveryError && (
            <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-4 mb-6 no-print">
              <div className="flex items-center space-x-3 mb-3">
                <AlertCircle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                <p className="text-yellow-300 font-bold">
                  Atenção
                </p>
              </div>
              <p className="text-yellow-200 text-sm">
                Houve um problema ao recuperar suas credenciais completas. Entre em contato com o suporte caso precise de ajuda.
              </p>
            </div>
          )}

          {/* Usuário existente - mostrar apenas email */}
          {hasOnlyEmail && !hasFullCredentials && (
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6 no-print">
              <div className="flex items-center space-x-3 mb-3">
                <AlertCircle className="h-6 w-6 text-blue-500 flex-shrink-0" />
                <p className="text-blue-300 font-bold">
                  Você já possui uma conta
                </p>
              </div>
              <p className="text-blue-200 text-sm">
                Você já possui uma conta associada ao email abaixo. Por favor, use sua senha atual para fazer login.
              </p>
            </div>
          )}

          <div className="printable-credentials">
            <h2>Suas Credenciais de Acesso</h2>
            
            <div className="credential-item">
              <span className="credential-label">Email:</span>
              <div className="credential-value">{userEmail || 'Não disponível'}</div>
            </div>
            
            {hasFullCredentials && (
              <div className="credential-item">
                <span className="credential-label">Senha:</span>
                <div className="credential-value">{userPassword}</div>
              </div>
            )}
            
            <p className="important-note">
              IMPORTANTE: Guarde estas informações em local seguro.
              {hasFullCredentials ? 'Você precisará desta senha para acessar o sistema.' : 'Use sua senha atual para fazer login.'}
            </p>
          </div>

          {/* Screen-only credentials display */}
          <div className="bg-gray-700 rounded-lg p-4 relative">
            <span className="block text-sm font-medium text-gray-300 mb-2">Email:</span>
            <div className="text-white font-mono bg-gray-900/50 p-3 rounded">
              {userEmail || 'Não disponível'}
            </div>
            {userEmail && (
              <button 
                onClick={() => copyToClipboard(userEmail, 'email')}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-600"
                title="Copiar email"
              >
                {copyStatus['email'] ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            )}
          </div>
          
          {hasFullCredentials ? (
            <div className="bg-gray-700 rounded-lg p-4 relative">
              <span className="block text-sm font-medium text-gray-300 mb-2">Senha:</span>
              <div className="text-white font-mono bg-gray-900/50 p-3 rounded border border-yellow-500">
                {userPassword}
              </div>
              <button 
                onClick={() => copyToClipboard(userPassword, 'password')}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-600"
                title="Copiar senha"
              >
                {copyStatus['password'] ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-4">
              <span className="block text-sm font-medium text-gray-300 mb-2">Senha:</span>
              <div className="text-gray-400 font-mono bg-gray-900/50 p-3 rounded">
                Use sua senha atual para login
              </div>
            </div>
          )}

          {hasFullCredentials && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
              <button
                onClick={printCredentials}
                className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center space-x-2"
              >
                <Save className="h-5 w-5" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={downloadCredentials}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Baixar Arquivo</span>
              </button>
            </div>
          )}

          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mt-6 no-print">
            <p className="text-blue-200 text-sm">
              {hasFullCredentials 
                ? 'Por segurança, recomendamos alterar sua senha após o primeiro acesso ao sistema.'
                : 'Em caso de dificuldades no acesso, entre em contato com o suporte.'}
            </p>
          </div>
          
          {/* Debug info - remover em produção */}
          <div className="mt-8 p-3 bg-gray-900 rounded-lg border border-gray-700 overflow-auto max-h-40 text-xs text-gray-400 font-mono no-print">
            <p className="text-yellow-500 mb-1">Debug info:</p>
            <pre>{debug}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmation; 