import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: {
    full_name?: string;
  };
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obter a sessão atual
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Erro ao obter sessão: ' + sessionError.message);
      }
      
      if (!sessionData.session) {
        setError('Você precisa estar logado para acessar esta página.');
        setLoading(false);
        return;
      }

      // Obter usuários através da API de administração (usando a função edge)
      const { data, error } = await supabase.functions.invoke('get-users', {
        body: {},
      });

      if (error) {
        throw new Error('Erro ao buscar usuários: ' + error.message);
      }

      setUsers(data?.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      setDeleteLoading(userId);
      setNotification(null);

      // Obter token da sessão atual
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Você precisa estar logado para excluir usuários.');
      }

      // Chamar a função edge para deletar o usuário
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) {
        throw new Error('Erro ao excluir usuário: ' + error.message);
      }

      // Remover o usuário da lista
      setUsers(users.filter(user => user.id !== userId));
      setNotification({
        type: 'success',
        message: 'Usuário excluído com sucesso!'
      });

      // Atualizar a lista após exclusão
      setTimeout(() => {
        fetchUsers();
      }, 1000);

    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao excluir usuário'
      });
      console.error('Erro ao excluir usuário:', err);
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Gerenciar Usuários</h1>
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="flex justify-center items-center h-40">
                <RefreshCw className="animate-spin h-10 w-10 text-lime-500" />
                <span className="ml-3 text-gray-300">Carregando usuários...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-32 pb-20 min-h-screen bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Gerenciar Usuários</h1>
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="flex items-center mb-4 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <p>{error}</p>
              </div>
              <button 
                onClick={fetchUsers}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Gerenciar Usuários</h1>
            <button 
              onClick={fetchUsers}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </button>
          </div>

          {notification && (
            <div className={`mb-6 p-4 rounded flex items-center ${notification.type === 'success' ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2" />
              )}
              <p>{notification.message}</p>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Último login
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {user.user_metadata?.full_name || 'Sem nome'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')
                            : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => deleteUser(user.id)}
                            disabled={deleteLoading === user.id}
                            className={`text-red-400 hover:text-red-300 inline-flex items-center ${deleteLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {deleteLoading === user.id ? (
                              <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                              <Trash2 className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers; 