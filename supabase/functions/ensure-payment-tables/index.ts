import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  // Responder a requisições OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Verificando tabelas de pagamento...");

    // Executar SQL para verificar/criar tabela payment_credentials
    const createTableSQL = `
    -- Criar tabela payment_credentials se não existir
    CREATE TABLE IF NOT EXISTS public.payment_credentials (
      id SERIAL PRIMARY KEY,
      payment_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      password TEXT,
      redirect_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      retrieved_at TIMESTAMP WITH TIME ZONE,
      retrieval_count INTEGER DEFAULT 0
    );
    
    -- Adicionar índices
    CREATE INDEX IF NOT EXISTS idx_payment_credentials_payment_id ON public.payment_credentials(payment_id);
    CREATE INDEX IF NOT EXISTS idx_payment_credentials_email ON public.payment_credentials(email);
    
    -- Habilitar RLS
    ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;
    
    -- Criar políticas de segurança
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'payment_credentials' AND policyname = 'Service pode inserir credenciais'
      ) THEN
        CREATE POLICY "Service pode inserir credenciais"
          ON public.payment_credentials FOR INSERT
          TO service_role
          USING (true);
      END IF;
      
      IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'payment_credentials' AND policyname = 'Service pode ler credenciais'
      ) THEN
        CREATE POLICY "Service pode ler credenciais"
          ON public.payment_credentials FOR SELECT
          TO service_role
          USING (true);
      END IF;
    END $$;
    
    -- Criar função get_payment_credentials caso não exista
    CREATE OR REPLACE FUNCTION get_payment_credentials(p_payment_id TEXT)
    RETURNS TABLE (
      email TEXT,
      password TEXT,
      redirect_url TEXT
    ) 
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      -- Atualizar contagem de recuperação
      UPDATE public.payment_credentials
      SET 
        retrieval_count = retrieval_count + 1,
        retrieved_at = now()
      WHERE 
        payment_id = p_payment_id;
        
      -- Retornar dados
      RETURN QUERY
      SELECT 
        pc.email,
        pc.password,
        pc.redirect_url
      FROM 
        public.payment_credentials pc
      WHERE 
        pc.payment_id = p_payment_id;
    END;
    $$;
    
    -- Adicionar comentário
    COMMENT ON TABLE public.payment_credentials IS 'Armazena credenciais temporárias após pagamento para recuperação caso o redirecionamento falhe';
    `;

    const { error: sqlError } = await supabase.rpc('pgexecute', { query: createTableSQL }).catch(err => {
      console.error("Erro ao executar SQL via rpc:", err);
      return { error: err };
    });

    if (sqlError) {
      console.error(`Erro ao executar SQL: ${sqlError.message}`);
      
      // Tentar método alternativo
      try {
        // Verificar se a tabela payment_credentials existe
        const { data: tableExists, error: tableCheckError } = await supabase.from('payment_credentials')
          .select('id')
          .limit(1);
          
        if (tableCheckError) {
          console.log("Tabela payment_credentials não existe, tentando criar...");
          
          // Executar cada comando SQL individualmente
          const createTableQuery = `
          CREATE TABLE IF NOT EXISTS public.payment_credentials (
            id SERIAL PRIMARY KEY,
            payment_id TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password TEXT,
            redirect_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            retrieved_at TIMESTAMP WITH TIME ZONE,
            retrieval_count INTEGER DEFAULT 0
          );`;
          
          const createIndexQuery = `
          CREATE INDEX IF NOT EXISTS idx_payment_credentials_payment_id ON public.payment_credentials(payment_id);
          CREATE INDEX IF NOT EXISTS idx_payment_credentials_email ON public.payment_credentials(email);`;
          
          const enableRLSQuery = `ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;`;
          
          // Executar consultas em sequência
          const queries = [createTableQuery, createIndexQuery, enableRLSQuery];
          
          for (const query of queries) {
            try {
              await supabase.rpc('pgexecute', { query }).catch(() => {
                console.log("Ignorando erro específico em:", query.substring(0, 50) + "...");
              });
            } catch (err) {
              console.log("Erro ignorado:", err.message);
            }
          }
        } else {
          console.log("Tabela payment_credentials já existe.");
        }
      } catch (altErr) {
        console.error("Erro no método alternativo:", altErr.message);
      }
    }

    console.log("Verificação de tabelas concluída");

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Tabelas de pagamento verificadas"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error(`Erro ao verificar tabelas: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Erro ao verificar tabelas",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}); 