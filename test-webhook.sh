#!/bin/bash

# Script para testar o webhook do Stripe e verificar se o cadastro de usuário funciona

# Cores para saída bonita
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de utilidade
print_header() {
  echo -e "\n${BLUE}=========================================${NC}"
  echo -e "${BLUE} $1 ${NC}"
  echo -e "${BLUE}=========================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}! $1${NC}"
}

print_step() {
  echo -e "\n${BLUE}➤ $1${NC}"
}

# Verificar dependências
check_dependencies() {
  print_header "Verificando dependências"
  
  if ! command -v curl &> /dev/null; then
    print_error "curl não está instalado"
    exit 1
  else
    print_success "curl está instalado"
  fi
  
  if ! command -v jq &> /dev/null; then
    print_warning "jq não está instalado. Algumas saídas serão difíceis de ler."
  else
    print_success "jq está instalado"
  fi
  
  if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI não está instalado"
    echo "Instale usando: npm install -g supabase"
    exit 1
  else
    print_success "Supabase CLI está instalado"
  fi
}

# Obter URL e variáveis de ambiente
get_environment() {
  print_header "Obtendo variáveis de ambiente"
  
  # Entrar no diretório do projeto Supabase
  cd supabase || { print_error "Diretório 'supabase' não encontrado!"; exit 1; }
  
  # Tentar obter o token se não estiver definido
  if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    if [ -f .env ]; then
      print_step "Carregando variáveis de ambiente de .env"
      export $(grep -v '^#' .env | xargs)
    else
      print_warning "SUPABASE_ACCESS_TOKEN não encontrado. Algumas operações podem falhar."
    fi
  fi
  
  # Obter URLs das funções
  WEBHOOK_URL=$(supabase functions url stripe-webhook)
  if [ -z "$WEBHOOK_URL" ]; then
    print_error "Não foi possível obter a URL do webhook"
    exit 1
  else
    print_success "URL do webhook: $WEBHOOK_URL"
  fi
  
  PROFILES_URL=$(supabase functions url ensure-profiles-table)
  if [ -z "$PROFILES_URL" ]; then
    print_warning "Não foi possível obter a URL da função ensure-profiles-table"
  else
    print_success "URL da função ensure-profiles-table: $PROFILES_URL"
  fi
  
  # Obter chave anônima do Supabase
  ANON_KEY=$(supabase status | grep "ANON KEY" | awk '{print $3}')
  if [ -z "$ANON_KEY" ]; then
    print_warning "Não foi possível obter a chave anônima do Supabase"
  else
    print_success "Chave anônima do Supabase obtida"
  fi
}

# Verificar tabelas necessárias
check_tables() {
  print_header "Verificando tabelas necessárias"
  
  # Garantir que as tabelas existam
  print_step "Executando função ensure-profiles-table"
  if [ -n "$PROFILES_URL" ] && [ -n "$ANON_KEY" ]; then
    RESULT=$(curl -s -X POST "$PROFILES_URL" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json")
    
    if echo "$RESULT" | grep -q "success"; then
      print_success "Tabela profiles verificada/criada com sucesso"
    else
      print_warning "Retorno da verificação de tabela: $RESULT"
    fi
  else
    print_warning "Não é possível verificar tabelas (URL ou chave ausente)"
  fi
}

# Gerar evento de teste do Stripe
test_stripe_webhook() {
  print_header "Testando webhook do Stripe"
  
  # Gerar email aleatório para o teste
  TEST_EMAIL="test_$(date +%s)@example.com"
  TEST_NAME="Usuário Teste"
  
  print_step "Enviando payload de teste para o webhook"
  print_step "Email de teste: $TEST_EMAIL"
  
  # Criar payload de teste (simulando um evento payment_intent.succeeded)
  PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_$(date +%s)",
  "object": "event",
  "api_version": "2023-10-16",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_test_$(date +%s)",
      "object": "payment_intent",
      "amount": 19900,
      "currency": "brl",
      "status": "succeeded",
      "metadata": {
        "email": "$TEST_EMAIL",
        "name": "$TEST_NAME"
      }
    }
  }
}
EOF
)
  
  # Enviar para o webhook
  RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  
  echo "Resposta do webhook:"
  echo "$RESPONSE"
  
  if echo "$RESPONSE" | grep -q "success"; then
    print_success "Webhook processou o evento com sucesso"
  else
    print_warning "Webhook retornou resposta inesperada"
  fi
  
  print_step "Verificando logs do webhook (últimos 20)"
  supabase functions logs stripe-webhook --limit 20
  
  print_step "Verificando se o usuário foi criado no Supabase"
  echo "Por favor, verifique manualmente no dashboard do Supabase se um usuário com email $TEST_EMAIL foi criado."
  echo "URL do dashboard: https://app.supabase.com/project/<seu-projeto-id>/auth/users"
}

# Verificar a função de recuperação de credenciais
test_credential_recovery() {
  print_header "Testando recuperação de credenciais"
  
  RECOVERY_URL=$(supabase functions url get-payment-credentials)
  if [ -z "$RECOVERY_URL" ]; then
    print_warning "Não foi possível obter a URL da função get-payment-credentials"
    return
  fi
  
  print_step "URL da função get-payment-credentials: $RECOVERY_URL"
  
  # Usar um ID de pagamento existente se disponível
  if [ -z "$TEST_PAYMENT_ID" ]; then
    TEST_PAYMENT_ID="pi_test_$(date +%s)"
    print_warning "Usando ID de pagamento fictício: $TEST_PAYMENT_ID"
  fi
  
  RESPONSE=$(curl -s -X POST "$RECOVERY_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"payment_id\": \"$TEST_PAYMENT_ID\"}")
  
  echo "Resposta da função de recuperação:"
  echo "$RESPONSE"
}

# Execução principal
main() {
  print_header "Iniciando teste do webhook de pagamento"
  
  check_dependencies
  get_environment
  check_tables
  test_stripe_webhook
  test_credential_recovery
  
  print_header "Teste concluído"
  echo "Verifique os logs acima para ter certeza de que tudo está funcionando corretamente."
  echo "Se o teste falhou, verifique:"
  echo "1. Se a tabela 'profiles' existe no banco de dados"
  echo "2. Se a função insert_profile está criada e tem as permissões corretas"
  echo "3. Se as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas"
  echo "4. Os logs do webhook para detalhes sobre o erro"
}

# Iniciar a execução
main 