# Script PowerShell para ajudar a atualizar senhas existentes para "123456"
Write-Host "====== Assistente para Atualização de Senhas ======" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script vai gerar uma consulta SQL para atualizar as senhas"
Write-Host "de usuários existentes para a senha padrão '123456'."
Write-Host ""
Write-Host "IMPORTANTE: Este script não executa a consulta automaticamente." -ForegroundColor Yellow
Write-Host "Você precisará copiar a consulta gerada e executá-la no SQL Editor do Supabase."
Write-Host ""

# Solicita ao usuário o email de um usuário que já tem a senha 123456
Write-Host "Para prosseguir, informe o email de um usuário que já tenha a senha '123456':" -ForegroundColor Green
$referenciaEmail = Read-Host "Email de referência"

if ([string]::IsNullOrWhiteSpace($referenciaEmail)) {
    Write-Host "❌ Email inválido. Operação cancelada." -ForegroundColor Red
    exit
}

# Gera a consulta SQL
$sqlQuery = @"
-- Consulta para atualizar todas as senhas para "123456"
-- Esta consulta obtém o hash da senha do usuário de referência 
-- e o aplica a todos os outros usuários

UPDATE auth.users
SET encrypted_password = 
    (SELECT encrypted_password FROM auth.users WHERE email = '$referenciaEmail')
WHERE encrypted_password != 
    (SELECT encrypted_password FROM auth.users WHERE email = '$referenciaEmail');

-- Para verificar quantos usuários serão afetados, execute primeiro:
-- SELECT count(*) FROM auth.users 
-- WHERE encrypted_password != 
--    (SELECT encrypted_password FROM auth.users WHERE email = '$referenciaEmail');
"@

# Copia a consulta para a área de transferência
Set-Clipboard -Value $sqlQuery

Write-Host ""
Write-Host "✅ Consulta SQL gerada e copiada para a área de transferência!" -ForegroundColor Green
Write-Host ""
Write-Host "A consulta atualizará todas as senhas para o mesmo hash da senha do usuário:" -ForegroundColor Yellow
Write-Host $referenciaEmail -ForegroundColor Yellow
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Magenta
Write-Host "1. Acesse o Dashboard do Supabase: https://dashboard.supabase.com"
Write-Host "2. Navegue até 'SQL Editor' no menu lateral"
Write-Host "3. Crie uma nova consulta"
Write-Host "4. Cole a consulta da área de transferência (Ctrl+V)"
Write-Host "5. Execute primeiro a parte comentada para verificar quantos usuários serão afetados"
Write-Host "6. Se estiver tudo correto, execute a consulta completa"
Write-Host ""
Write-Host "ATENÇÃO: Faça um backup do banco de dados antes de executar a consulta!" -ForegroundColor Red 