import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles = [] }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRequiredRole, setHasRequiredRole] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);

        // Verificar se o usuário está autenticado
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao verificar autenticação:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        if (!session) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // Se não há restrições de papel, permitir acesso
        if (allowedRoles.length === 0) {
          setHasRequiredRole(true);
          setIsLoading(false);
          return;
        }

        // Verificar papel do usuário
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Erro ao buscar perfil do usuário:', profileError);
          setHasRequiredRole(false);
          setIsLoading(false);
          return;
        }

        // Verificar se o usuário tem um dos papéis permitidos
        const userRole = profile?.role || 'user';
        setHasRequiredRole(allowedRoles.includes(userRole));
        
      } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
        setIsAuthenticated(false);
        setHasRequiredRole(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [allowedRoles]);

  if (isLoading) {
    return (
      <div className="pt-32 pb-20 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <RefreshCw className="animate-spin h-10 w-10 text-lime-500 mb-4" />
          <p className="text-gray-300">Verificando suas permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirecionar para a página de login com o caminho atual como redirecionamento após login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRequiredRole) {
    // Redirecionar para uma página de acesso negado
    return <Navigate to="/access-denied" replace />;
  }

  // O usuário está autenticado e tem o papel necessário
  return <>{children}</>;
};

export default ProtectedRoute; 