#!/bin/bash

# Script para implantar as funções Edge do Supabase

echo "Implantando as funções Edge do Supabase..."

# Certifique-se de que o Supabase CLI está instalado e configurado
echo "Verificando a instalação do Supabase CLI..."
if ! command -v supabase &> /dev/null
then
    echo "Supabase CLI não encontrado! Por favor instale usando npm install -g supabase"
    exit 1
fi

# Solicitar o Project Ref do Supabase
read -p "Digite o Project Ref do seu projeto Supabase: " project_ref

if [ -z "$project_ref" ]; then
    echo "Project Ref é obrigatório. Encerrando script."
    exit 1
fi

echo "Implantando funções de checkout do Stripe..."
supabase functions deploy stripe-checkout --project-ref $project_ref
supabase functions deploy stripe-checkout-jwt --project-ref $project_ref

echo "Implantando função stripe-webhook..."
supabase functions deploy stripe-webhook --project-ref $project_ref

echo "Implantando utilitários compartilhados..."
supabase functions deploy _shared --project-ref $project_ref
supabase functions deploy utils --project-ref $project_ref

echo "Configurando segredos..."
read -p "Digite sua API Key do SendGrid: " sendgrid_api_key
supabase secrets set SENDGRID_API_KEY="$sendgrid_api_key" --project-ref $project_ref

read -p "Digite o email do remetente (ex: DRC Finanças <noreply@dominio.com>): " email_from
supabase secrets set EMAIL_FROM="$email_from" --project-ref $project_ref

read -p "Digite a URL da aplicação: " app_url
supabase secrets set APP_URL="$app_url" --project-ref $project_ref

echo "Implantação concluída com sucesso!"
echo "Lembre-se de configurar o webhook do Stripe para apontar para: https://$project_ref.supabase.co/functions/v1/stripe-webhook" 