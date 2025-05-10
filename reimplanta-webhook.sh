#!/bin/bash

echo "===== Reimplantação da função webhook do Stripe ====="
echo
echo "Este script vai reimplantar a função Edge do Stripe Webhook"
echo "com a correção para o erro SubtleCryptoProvider."
echo
echo "Certifique-se de ter o Supabase CLI instalado"
echo "e estar logado na sua conta."
echo

read -p "Pressione Enter para continuar..."

echo
echo "Navegando para o diretório da função..."
cd supabase/functions/stripe-webhook || {
    echo "ERRO: Diretório não encontrado"
    exit 1
}

echo
echo "Verificando se a CLI do Supabase está instalada..."
if ! command -v supabase &> /dev/null; then
    echo
    echo "ERRO: CLI do Supabase não encontrada."
    echo "Para instalar, execute:"
    echo "    npm install -g supabase"
    echo
    echo "Após a instalação, faça login com:"
    echo "    supabase login"
    echo
    exit 1
fi

echo
echo "Reimplantando a função..."
supabase functions deploy stripe-webhook || {
    echo
    echo "ERRO: Ocorreu um problema durante a reimplantação."
    echo "Verifique as mensagens acima."
    echo
    exit 1
}

echo
echo "===== Sucesso! ====="
echo
echo "A função foi reimplantada com a correção."
echo
echo "Agora configure os seguintes detalhes no Stripe:"
echo "1. No Dashboard do Stripe, vá para Developers -> Webhooks"
echo "2. Selecione seu webhook"
echo "3. Adicione o cabeçalho personalizado:"
echo "   - Nome: x-webhook-secret"
echo "   - Valor: [SEU_WEBHOOK_SECRET] (mesmo valor de STRIPE_WEBHOOK_SECRET)"
echo
echo "Consulte o arquivo SOLUCAO-WEBHOOK-STRIPE.md para mais detalhes."
echo 