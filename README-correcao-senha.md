# Correção do Problema de Senhas em Webhook Stripe

## O Problema

Identificamos um problema crítico no sistema de pagamento:

1. **Senhas aleatórias em vez de padrão**: A função Edge `stripe-webhook` no Supabase estava gerando senhas aleatórias para novos usuários em vez de usar a senha padrão "123456" configurada no resto do sistema.

2. **Erro de compatibilidade**: Foi identificado o erro "SubtleCryptoProvider cannot be used in a synchronous context", causado por um uso inadequado de funções criptográficas síncronas.

## A Solução

Foi criada uma versão atualizada do webhook que:

1. Utiliza **sempre "123456" como senha padrão** para todos os usuários.
2. **Evita o uso síncrono** de funções criptográficas para prevenir o erro SubtleCryptoProvider.
3. Mantém intacta a funcionalidade de **cadastro automático de usuários** após pagamento.

## Arquivos e Scripts Disponíveis

Esta solução inclui os seguintes recursos:

### Documentação
- `COMO-CORRIGIR-SENHAS.md` - Guia passo a passo detalhado para implementar a correção.
- `README-correcao-senha.md` - Este documento, explicando a solução.

### Código Fonte
- `webhook-compativel.txt` - Versão corrigida e compatível do código do webhook.

### Scripts de Automação
- `atualizar-webhook.ps1` - Script para copiar o código corrigido para a área de transferência.
- `atualizar-senhas.ps1` - Script para ajudar a atualizar senhas existentes para "123456".
- `testar-correcao.ps1` - Script para testar se a correção foi implementada corretamente.
- `deploy-webhook-fix.ps1` - Script para configurar o arquivo config.toml (caso necessário).

### Scripts de Teste
- `implanta-webhook.js` - Testa a função webhook enviando um evento simulado.
- `deploy-stripe-webhook-fix.js` - Teste mais completo com múltiplos cenários.

## Como Usar os Scripts

### 1. Atualizar o Código do Webhook

```powershell
.\atualizar-webhook.ps1
```
Este script copia o código corrigido para a área de transferência. Você precisa colá-lo no editor do Supabase Dashboard.

### 2. Testar a Correção

```powershell
.\testar-correcao.ps1
```
Este script executa um teste para verificar se o webhook está gerando a senha "123456".

### 3. Atualizar Senhas Existentes (opcional)

```powershell
.\atualizar-senhas.ps1
```
Se você tiver usuários existentes com senhas aleatórias, este script gera o SQL necessário para atualizar todas as senhas para "123456".

### 4. Configurar o config.toml (se necessário)

```powershell
.\deploy-webhook-fix.ps1
```
Se o erro "SubtleCryptoProvider" persistir, este script configura o arquivo config.toml para desativar a verificação JWT que causa o problema.

## Fluxo Recomendado

1. Leia primeiro o guia `COMO-CORRIGIR-SENHAS.md` para entender todo o processo.
2. Execute `atualizar-webhook.ps1` para copiar o código corrigido.
3. Atualize a função no Dashboard do Supabase.
4. Execute `testar-correcao.ps1` para verificar se a correção funcionou.
5. Se necessário, execute `atualizar-senhas.ps1` para corrigir senhas existentes.

## Notas Importantes

- **Faça backup** do banco de dados antes de executar atualizações em massa.
- Verifique os **logs no Dashboard do Supabase** para identificar possíveis erros.
- Após a correção, faça um teste real com um pagamento para confirmar que tudo está funcionando.

## Prevenção Futura

Para evitar problemas semelhantes no futuro:

1. Adicione **testes automatizados** que verificam o comportamento do webhook.
2. Implemente um sistema de **versionamento e deploy** para as funções Edge.
3. Documente claramente o comportamento esperado das funções críticas.
4. Considere adicionar **revisão de código** para alterações em componentes críticos. 