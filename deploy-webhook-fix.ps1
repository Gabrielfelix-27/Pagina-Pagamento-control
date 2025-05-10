# Script PowerShell para implantar a função stripe-webhook atualizada
Write-Host "====== Implantando a função Edge atualizada para correção do erro SubtleCryptoProvider ======"
Write-Host ""
Write-Host "Este script vai implantar a versão atualizada da função stripe-webhook"
Write-Host "que resolve o problema do erro SubtleCryptoProvider usando config.toml."
Write-Host ""

# Verifica se o Supabase CLI está instalado
try {
    $supabaseCli = supabase --version
    Write-Host "✅ Supabase CLI detectado: $supabaseCli" -ForegroundColor Green
} 
catch {
    Write-Host "❌ A CLI do Supabase não está instalada ou não está no PATH" -ForegroundColor Red
    Write-Host "Por favor, instale a CLI do Supabase seguindo as instruções em:"
    Write-Host "https://supabase.com/docs/guides/cli"
    exit 1
}

Write-Host ""
Write-Host "Verificando arquivo config.toml..."
$configPath = "supabase/functions/config.toml"
if (Test-Path $configPath) {
    Write-Host "✅ Arquivo config.toml encontrado" -ForegroundColor Green
    
    # Verificar se o conteúdo está correto
    $configContent = Get-Content $configPath -Raw
    if ($configContent -match '\[functions.stripe-webhook\]' -and $configContent -match 'verify_jwt = false') {
        Write-Host "✅ Configuração do webhook está correta no config.toml" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Configuração do webhook não encontrada no config.toml" -ForegroundColor Yellow
        Write-Host "Adicionando configuração..."
        Add-Content -Path $configPath -Value "`n[functions.stripe-webhook]`nverify_jwt = false"
        Write-Host "✅ Configuração adicionada ao config.toml" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️ Arquivo config.toml não encontrado" -ForegroundColor Yellow
    Write-Host "Criando arquivo config.toml..."
    New-Item -Path $configPath -ItemType File -Force
    Add-Content -Path $configPath -Value "[functions.stripe-webhook]`nverify_jwt = false"
    Write-Host "✅ Arquivo config.toml criado com a configuração correta" -ForegroundColor Green
}

Write-Host ""
Write-Host "Navegando para o diretório da função..."
Set-Location -Path "supabase/functions/stripe-webhook"

Write-Host ""
Write-Host "Implantando a função atualizada..."
supabase functions deploy stripe-webhook

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====== Implantação concluída com sucesso! =====" -ForegroundColor Green
    Write-Host ""
    Write-Host "A função foi atualizada com a correção para o erro SubtleCryptoProvider."
    Write-Host "A verificação JWT foi desativada via config.toml."
    Write-Host ""
    Write-Host "Próximos passos:"
    Write-Host "1. Executar o script de teste para verificar se a correção está funcionando:"
    Write-Host "   node implanta-webhook.js"
    Write-Host ""
    Write-Host "2. Configurar o webhook no Stripe:"
    Write-Host "   - URL: https://gyogfvfmsotveacjcckr.supabase.co/functions/v1/stripe-webhook"
    Write-Host "   - Eventos: checkout.session.completed, payment_intent.succeeded, customer.subscription.created"
    Write-Host "   - Não é necessário adicionar cabeçalhos personalizados - apenas use o signing secret"
    Write-Host ""
    Write-Host "3. Verificar os logs no Supabase para confirmar que a função está funcionando corretamente"
} 
else {
    Write-Host ""
    Write-Host "❌ Erro ao implantar a função" -ForegroundColor Red
    Write-Host "Verifique se você está logado na conta do Supabase e tente novamente."
    Write-Host "Para logar, execute: supabase login"
}

# Voltar para o diretório original
Set-Location -Path "../../.." 