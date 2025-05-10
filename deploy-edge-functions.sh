#!/bin/bash

# Script para implantar as Edge Functions do Supabase relacionadas ao fluxo de pagamento
# e executar migrações para criar tabelas necessárias

echo "Iniciando implantação das Edge Functions do Supabase e migrações..."

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "Erro: Supabase CLI não está instalado!"
    echo "Instale usando: npm install -g supabase"
    exit 1
fi

# Entrar no diretório do projeto Supabase
cd supabase || { echo "Erro: Diretório 'supabase' não encontrado!"; exit 1; }

# Verificar se as variáveis de ambiente estão disponíveis
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    if [ -f .env ]; then
        echo "Carregando variáveis de ambiente de .env"
        export $(grep -v '^#' .env | xargs)
    else
        echo "AVISO: SUPABASE_ACCESS_TOKEN não encontrado. Faça login primeiro com 'supabase login'."
    fi
fi

echo "==========================================="
echo "Verificando status do projeto..."
echo "==========================================="
supabase status || { echo "Erro: Falha ao verificar status do projeto Supabase."; exit 1; }

echo "==========================================="
echo "Implantando Edge Functions..."
echo "==========================================="

echo "1. Implantando função stripe-webhook..."
supabase functions deploy stripe-webhook --no-verify-jwt || { echo "Erro ao implantar stripe-webhook"; exit 1; }

echo "2. Implantando função get-payment-credentials..."
supabase functions deploy get-payment-credentials --no-verify-jwt || { echo "Erro ao implantar get-payment-credentials"; exit 1; }

echo "3. Implantando função ensure-payment-tables..."
supabase functions deploy ensure-payment-tables --no-verify-jwt || { echo "Erro ao implantar ensure-payment-tables"; exit 1; }

echo "4. Implantando função ensure-profiles-table..."
supabase functions deploy ensure-profiles-table --no-verify-jwt || { echo "Erro ao implantar ensure-profiles-table"; exit 1; }

echo "==========================================="
echo "Executando migrações de banco de dados..."
echo "==========================================="

# Aplicar migrações diretamente
if [ -f migrations/ensure_profiles_table.sql ]; then
    echo "Aplicando migração da tabela profiles..."
    supabase db push migrations/ensure_profiles_table.sql || { 
        echo "Aviso: Falha ao aplicar migração ensure_profiles_table.sql. Tentando método alternativo...";
        
        # Método alternativo: executar via API
        echo "Executando ensure-profiles-table para criar a tabela profiles..."
        curl -s -X POST "$(supabase functions url ensure-profiles-table)" \
          -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
          -H "Content-Type: application/json"
    }
else
    echo "Arquivo de migração ensure_profiles_table.sql não encontrado."
fi

if [ -f migrations/create_payment_credentials_table.sql ]; then
    echo "Aplicando migração da tabela payment_credentials..."
    supabase db push migrations/create_payment_credentials_table.sql || {
        echo "Aviso: Falha ao aplicar migração create_payment_credentials_table.sql. Tentando método alternativo...";
        
        # Método alternativo: executar via API
        echo "Executando ensure-payment-tables para criar tabelas relacionadas ao pagamento..."
        curl -s -X POST "$(supabase functions url ensure-payment-tables)" \
          -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
          -H "Content-Type: application/json"
    }
else
    echo "Arquivo de migração create_payment_credentials_table.sql não encontrado."
fi

echo "==========================================="
echo "Verificando que as tabelas foram criadas..."
echo "==========================================="

echo "1. Executando ensure-profiles-table..."
curl -s -X POST "$(supabase functions url ensure-profiles-table)" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  | jq || echo "Aviso: Falha ao executar ensure-profiles-table ou 'jq' não está instalado."

echo "2. Executando ensure-payment-tables..."
curl -s -X POST "$(supabase functions url ensure-payment-tables)" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  | jq || echo "Aviso: Falha ao executar ensure-payment-tables ou 'jq' não está instalado."

echo "==========================================="
echo "Verificando as variáveis de ambiente..."
echo "==========================================="
supabase functions env list || { echo "Erro ao listar variáveis de ambiente"; exit 1; }

echo ""
echo "Implantação concluída com sucesso!"
echo "============================================="
echo "URLs das funções:"
echo "- Stripe Webhook: $(supabase functions url stripe-webhook)"
echo "- Get Payment Credentials: $(supabase functions url get-payment-credentials)"
echo "- Ensure Payment Tables: $(supabase functions url ensure-payment-tables)"
echo "- Ensure Profiles Table: $(supabase functions url ensure-profiles-table)"
echo "============================================="
echo "Importante: Certifique-se de configurar a URL do webhook no Stripe:"
echo "  $(supabase functions url stripe-webhook)"
echo ""
echo "Para testar o fluxo de pagamento:"
echo "1. Faça um pagamento de teste no Stripe"
echo "2. Verifique os logs do webhook: supabase functions logs stripe-webhook"
echo "3. Verifique nas tabelas do banco de dados se o usuário foi criado"
echo "4. Se houver problemas no redirecionamento, use a função get-payment-credentials" 