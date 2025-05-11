# Script PowerShell para testar a correção da função stripe-webhook
Write-Host "====== Teste de Validação do Webhook Corrigido ======" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script vai executar um teste para verificar se o webhook"
Write-Host "está gerando corretamente a senha '123456' para novos usuários."
Write-Host ""

# Verificar se o Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js detectado: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Node.js não encontrado. Por favor, instale o Node.js para continuar." -ForegroundColor Red
    exit
}

# Verificar se o arquivo de teste existe
$testScript = "implanta-webhook.js"
if (Test-Path $testScript) {
    Write-Host "✅ Script de teste encontrado: $testScript" -ForegroundColor Green
    
    # Executar o teste
    Write-Host ""
    Write-Host "Executando teste do webhook. Aguarde..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------"
    
    # Executar o script Node.js
    node $testScript
    
    Write-Host "------------------------------------------------"
    Write-Host ""
    
    # Solicitar confirmação do usuário
    Write-Host "O teste foi concluído. Você conseguiu verificar se a senha '123456' está sendo usada?" -ForegroundColor Magenta
    $confirmacao = Read-Host "Digite 'sim' se o teste foi bem-sucedido, ou 'não' caso contrário"
    
    if ($confirmacao -eq "sim") {
        Write-Host ""
        Write-Host "✅ Correção implementada com sucesso!" -ForegroundColor Green
        Write-Host "   O webhook está gerando a senha padrão '123456' conforme esperado." -ForegroundColor Green
        Write-Host ""
        Write-Host "Próximos passos possíveis:" -ForegroundColor Cyan
        Write-Host "1. Se necessário, atualize as senhas de usuários existentes usando o script 'atualizar-senhas.ps1'"
        Write-Host "2. Documente a solução implementada para referência futura"
        Write-Host "3. Considere adicionar testes automatizados para evitar regressões"
    } else {
        Write-Host ""
        Write-Host "❌ A correção não está funcionando conforme esperado." -ForegroundColor Red
        Write-Host "   Revise o código do webhook e verifique se:" -ForegroundColor Yellow
        Write-Host "   - A função generateRandomPassword() está retornando '123456'"
        Write-Host "   - O código foi realmente atualizado no Supabase Dashboard"
        Write-Host "   - A configuração do config.toml está correta"
        Write-Host ""
        Write-Host "Tente os seguintes passos:" -ForegroundColor Cyan 
        Write-Host "1. Execute novamente o script 'atualizar-webhook.ps1' para copiar o código correto"
        Write-Host "2. Verifique no dashboard do Supabase se há erros nos logs da função"
        Write-Host "3. Consulte o arquivo 'COMO-CORRIGIR-SENHAS.md' para instruções detalhadas"
    }
} else {
    Write-Host "❌ Erro: O arquivo $testScript não foi encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar executando este script no diretório correto."
    Write-Host "O arquivo $testScript deve estar no mesmo diretório deste script."
} 