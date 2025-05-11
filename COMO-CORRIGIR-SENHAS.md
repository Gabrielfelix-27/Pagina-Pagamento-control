# Guia para Corrigir o Problema das Senhas Aleatórias

## O Problema

O sistema de pagamento deveria usar a senha padrão "123456" para todos os usuários, mas a função Edge Function `stripe-webhook` no dashboard do Supabase ainda está usando a versão antiga que gera senhas aleatórias, enquanto os arquivos locais já foram atualizados.

Além disso, foi identificado um erro de compatibilidade: "SubtleCryptoProvider cannot be used in a synchronous context".

## A Solução

Substituir o código atual do webhook por uma versão compatível que:
- Sempre use "123456" como senha padrão
- Evite o uso síncrono de funções criptográficas
- Mantenha o cadastro automático de usuários após pagamento

## Passo a Passo para Correção

### 1. Acessar o Dashboard do Supabase

1. Acesse [dashboard.supabase.com](https://dashboard.supabase.com)
2. Faça login com suas credenciais
3. Selecione o projeto do sistema de pagamento

### 2. Editar a Função Edge "stripe-webhook"

1. No menu lateral esquerdo, clique em "Edge Functions"
2. Localize a função "stripe-webhook" na lista
3. Clique na função para abri-la
4. Clique em "Edit Code" para editar o código da função

### 3. Substituir o Código Atual

1. Selecione todo o código atual da função (Ctrl+A)
2. Copie o conteúdo do arquivo `webhook-compativel.txt` deste projeto
3. Cole o código no editor do Supabase, substituindo todo o conteúdo anterior
4. Verifique se a função `generateRandomPassword()` agora sempre retorna "123456"
5. Clique em "Save" ou "Deploy" para salvar e implantar as alterações

### 4. Configurar o arquivo config.toml (se necessário)

Se o erro "SubtleCryptoProvider" persistir, será necessário também configurar o arquivo config.toml:

1. No dashboard do Supabase, navegue até "Settings" > "API"
2. Verifique se há uma seção para configurar funções Edge
3. Adicione a seguinte configuração (ou use o script `deploy-webhook-fix.ps1` deste projeto):
   ```toml
   [functions.stripe-webhook]
   verify_jwt = false
   ```

### 5. Testar a Correção

1. Execute o script `implanta-webhook.js` para testar o webhook:
   ```
   node implanta-webhook.js
   ```
2. Verifique se a resposta é positiva (status 200)
3. Verifique no Supabase se um novo usuário foi criado com a senha "123456"

### 6. Atualizar Senhas Existentes (Opcional)

Para usuários já cadastrados com senhas aleatórias, você pode executar uma consulta SQL para atualizar todas as senhas para "123456":

```sql
-- Execute esta consulta no SQL Editor do Supabase
UPDATE auth.users
SET encrypted_password = 
    (SELECT encrypted_password FROM auth.users WHERE email = 'um-usuario-com-senha-123456@exemplo.com')
WHERE encrypted_password != 
    (SELECT encrypted_password FROM auth.users WHERE email = 'um-usuario-com-senha-123456@exemplo.com');
```

## Verificação Final

Faça um teste completo do sistema:
1. Realize um pagamento
2. Verifique se um novo usuário é criado automaticamente
3. Tente fazer login com o email usado e a senha "123456"
4. Confirme que o login funciona corretamente

Se tudo estiver funcionando, o problema está resolvido! 