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
      
      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      
      // Primeira tentativa: API Function
      const { data, error } = await supabase.functions.invoke('get-payment-credentials', {
        body: { payment_id: sessionId, _ts: timestamp }
      });
      
      if (error) {
        console.error('Erro ao recuperar credenciais:', error);
        
        // Segunda tentativa: Direct RPC Call
        console.log('Tentando segunda abordagem: RPC direta');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_payment_credentials', { 
          p_payment_id: sessionId 
        });
        
        if (rpcError) {
          console.error('Erro na chamada RPC:', rpcError);
          setRecoveryError(`Falha ao recuperar credenciais: ${error.message}`);
          return false;
        }
        
        if (rpcData && rpcData.length > 0) {
          console.log('Credenciais recuperadas via RPC!', rpcData[0]);
          
          if (rpcData[0].email) {
            setUserEmail(rpcData[0].email);
          }
          
          // Sempre usar a senha padrão
          setUserPassword("123456");
          
          setDebug(prev => `${prev}\n\nCredenciais recuperadas via RPC:\n${JSON.stringify(rpcData[0], null, 2)}`);
          return true;
        } else {
          console.log('RPC não retornou dados:', rpcData);
          setRecoveryError(`Falha ao recuperar credenciais: ${error.message}`);
          return false;
        }
      }
      
      if (data && data.success && data.data) {
        console.log('Credenciais recuperadas com sucesso!', data.source, data);
        
        if (data.data.email) {
          setUserEmail(data.data.email);
        }
        
        // Sempre usar a senha padrão
        setUserPassword("123456");
        
        setDebug(prev => `${prev}\n\nCredenciais recuperadas via API (${data.source}):\n${JSON.stringify(data.data, null, 2)}`);
        return true;
      } else {
        console.warn('API retornou sem erro, mas sem dados válidos:', data);
        
        // Tentar recuperar diretamente da tabela payment_credentials como alternativa
        try {
          console.log('Tentando recuperar diretamente da tabela payment_credentials');
          const { data: tableData, error: tableError } = await supabase
            .from('payment_credentials')
            .select('*')
            .eq('payment_id', sessionId)
            .maybeSingle();
            
          if (tableError) {
            console.error('Erro ao consultar tabela:', tableError);
          } else if (tableData) {
            console.log('Credenciais recuperadas da tabela!', tableData);
            
            if (tableData.email) {
              setUserEmail(tableData.email);
            }
            
            // Sempre usar a senha padrão
            setUserPassword("123456");
            
            setDebug(prev => `${prev}\n\nCredenciais recuperadas diretamente da tabela:\n${JSON.stringify(tableData, null, 2)}`);
            return true;
          }
        } catch (tableErr) {
          console.error('Exceção ao consultar tabela:', tableErr);
        }
        
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
      
      console.log('Email param:', emailParam);
      console.log('Password param:', passwordParam);
      console.log('Session ID:', sessionIdParam);
      console.log('Payment ID:', paymentIdParam);
      
      // Flag para indicar se precisamos tentar recuperação
      let needsRecovery = false;
      
      if (emailParam) {
        console.log('Email encontrado:', emailParam);
        setUserEmail(emailParam);
      } else {
        console.log('Email não encontrado nos parâmetros');
        needsRecovery = true;
      }
      
      // Definir sempre a senha padrão, independente do parâmetro
      console.log('Definindo senha padrão: 123456');
      setUserPassword("123456");
      
      // Se faltam dados e temos um ID de sessão/pagamento, tentamos recuperar
      if (needsRecovery && (sessionIdParam || paymentIdParam) && !recoveryAttempted) {
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
Senha: 123456
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

        <div className="bg-lime-900/30 border border-lime-500/30 rounded-lg p-4 mb-6 no-print">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="h-6 w-6 text-lime-500 flex-shrink-0" />
            <p className="text-lime-300 font-bold">
              Política de Senha Padrão
            </p>
          </div>
          <p className="text-lime-200 text-sm">
            Para sua conveniência, todos os novos usuários recebem a senha padrão <strong>123456</strong>. 
            Essa senha será válida para todos os acessos até que você a altere. 
            Recomendamos fortemente que você altere essa senha no primeiro acesso.
          </p>
        </div>

        <div className="space-y-6">
          {/* Alert Banner - Extremely Important */}
          {recoveryError && (
            <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-4 mb-6 no-print">
              <div className="flex items-center space-x-3 mb-3">
                <AlertCircle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                <p className="text-yellow-300 font-bold">
                  Atenção
                </p>
              </div>
              <p className="text-yellow-200 text-sm">
                Houve um problema ao recuperar suas credenciais completas. Entre em contato com o suporte com seu email e o código de referência: {debug ? JSON.parse(debug).payment_intent || JSON.parse(debug).session_id : 'não disponível'}
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
                Você já possui uma conta associada ao email abaixo. Se esta é sua primeira compra, 
                tente usar a senha padrão <strong>123456</strong> para fazer login. 
                Caso já tenha alterado sua senha, use a senha atual para acessar o sistema.
              </p>
            </div>
          )}

          {/* Credenciais */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-medium text-white mb-4">Suas Credenciais de Acesso</h2>
            
            <div className="mb-4">
              <span className="block text-sm font-medium text-gray-300 mb-2">Email:</span>
              <div className="text-white font-mono bg-gray-900/50 p-3 rounded flex justify-between items-center">
                <span>{userEmail || 'Não disponível'}</span>
                {userEmail && (
                  <button 
                    onClick={() => copyToClipboard(userEmail, 'email')}
                    className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-600 ml-2"
                    title="Copiar email"
                  >
                    {copyStatus['email'] ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                )}
              </div>
            </div>
            
            <div className="mb-4">
              <span className="block text-sm font-medium text-gray-300 mb-2">Senha:</span>
              <div className="text-white font-mono bg-gray-900/50 p-3 rounded flex justify-between items-center">
                <span>{userPassword || 'Se for seu primeiro acesso, a senha é 123456, ou use sua senha atual'}</span>
                {userPassword && (
                  <button 
                    onClick={() => copyToClipboard(userPassword, 'password')}
                    className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-600 ml-2"
                    title="Copiar senha"
                  >
                    {copyStatus['password'] ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                )}
              </div>
              <p className="mt-2 text-yellow-300 text-sm">
                <span className="font-bold">IMPORTANTE:</span> A senha padrão para todos os novos usuários é "123456". 
                Por segurança, altere esta senha após o primeiro acesso.
              </p>
            </div>
            
            {userPassword && (
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={downloadCredentials}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 px-4 rounded-md flex items-center justify-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Credenciais
                </button>
                <button
                  onClick={printCredentials}
                  className="flex-1 bg-lime-700 hover:bg-lime-800 text-white py-2 px-4 rounded-md flex items-center justify-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Imprimir
                </button>
              </div>
            )}
          </div>
          
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