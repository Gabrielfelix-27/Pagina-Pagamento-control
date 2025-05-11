# Script PowerShell para copiar o código do webhook compatível para a área de transferência
Write-Host "====== Copiando Webhook Compatível para a Área de Transferência ======" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script vai copiar o código da versão compatível do webhook para a área de transferência."
Write-Host "Você poderá então colar este código no editor do Supabase Dashboard."
Write-Host ""

# Verificar se o arquivo webhook-compativel.txt existe
$webhookFilePath = "webhook-compativel.txt"
if (Test-Path $webhookFilePath) {
    # Ler o conteúdo do arquivo
    $webhookCode = Get-Content -Path $webhookFilePath -Raw
    
    # Copiar para a área de transferência
    Set-Clipboard -Value $webhookCode
    
    Write-Host "✅ Código copiado com sucesso para a área de transferência!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Yellow
    Write-Host "1. Acesse o Dashboard do Supabase: https://dashboard.supabase.com"
    Write-Host "2. Navegue até 'Edge Functions' no menu lateral"
    Write-Host "3. Clique na função 'stripe-webhook'"
    Write-Host "4. Clique em 'Edit Code'"
    Write-Host "5. Selecione todo o código atual (Ctrl+A)"
    Write-Host "6. Cole o código da área de transferência (Ctrl+V)"
    Write-Host "7. Clique em 'Deploy' para atualizar a função"
    Write-Host ""
    Write-Host "Após atualizar o webhook, teste a integração com o script:"
    Write-Host "node implanta-webhook.js"
    Write-Host ""
} else {
    Write-Host "❌ Erro: O arquivo $webhookFilePath não foi encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar executando este script no diretório correto."
    Write-Host "O arquivo webhook-compativel.txt deve estar no mesmo diretório deste script."
} 