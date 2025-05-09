import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      
      setError(null);
      alert('Verifique seu email para confirmar o cadastro!');
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      
      alert('Verifique seu email para redefinir sua senha!');
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar email de redefinição');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
        
        {mode === 'login' && (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center">Entrar na sua conta</h2>
            
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-500 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-lime-500 hover:bg-lime-400 text-black font-bold py-3 px-4 rounded-lg transition-colors ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Processando...' : 'Entrar'}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => setMode('forgot')}
                className="text-lime-400 hover:underline text-sm"
              >
                Esqueceu sua senha?
              </button>
              
              <div className="mt-4">
                <span className="text-gray-400 text-sm">Não tem uma conta? </span>
                <button 
                  onClick={() => setMode('register')}
                  className="text-lime-400 hover:underline text-sm font-medium"
                >
                  Criar conta
                </button>
              </div>
            </div>
          </>
        )}
        
        {mode === 'register' && (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center">Criar nova conta</h2>
            
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-500 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-400 mt-1">Mínimo de 6 caracteres</p>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-lime-500 hover:bg-lime-400 text-black font-bold py-3 px-4 rounded-lg transition-colors ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Processando...' : 'Criar Conta'}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <span className="text-gray-400 text-sm">Já tem uma conta? </span>
              <button 
                onClick={() => setMode('login')}
                className="text-lime-400 hover:underline text-sm font-medium"
              >
                Entrar
              </button>
            </div>
          </>
        )}
        
        {mode === 'forgot' && (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center">Recuperar Senha</h2>
            
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-500 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleResetPassword}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-lime-500 hover:bg-lime-400 text-black font-bold py-3 px-4 rounded-lg transition-colors ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Processando...' : 'Enviar Link de Recuperação'}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => setMode('login')}
                className="text-lime-400 hover:underline text-sm"
              >
                Voltar para o login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal; 