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

    console.log("[INFO] Verificando tabela profiles...");

    // Executar SQL para verificar/criar tabela profiles
    const createTableSQL = `
    -- Verifica se a tabela profiles já existe
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        -- Cria a tabela profiles se não existir
        CREATE TABLE public.profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          full_name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          stripe_customer_id TEXT,
          subscription_status TEXT,
          subscription_id TEXT,
          plan_id TEXT,
          payment_status TEXT,
          subscription_period_end TIMESTAMP WITH TIME ZONE,
          last_payment_id TEXT,
          last_payment_status TEXT,
          last_payment_amount DECIMAL(10,2),
          last_payment_date TIMESTAMP WITH TIME ZONE,
          payment_source TEXT,
          is_subscribed BOOLEAN DEFAULT FALSE
        );

        -- Configurar políticas de segurança RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

        -- Criar políticas
        CREATE POLICY "Usuários podem ver seu próprio perfil"
          ON public.profiles FOR SELECT
          USING (auth.uid() = id);

        CREATE POLICY "Usuários podem atualizar seu próprio perfil"
          ON public.profiles FOR UPDATE
          USING (auth.uid() = id);

        CREATE POLICY "Service pode gerenciar todos os perfis"
          ON public.profiles FOR ALL
          TO service_role
          USING (true);

        RAISE NOTICE 'Tabela profiles criada com sucesso';
      ELSE
        RAISE NOTICE 'Tabela profiles já existe';
        
        -- Adicionar colunas que possam estar faltando
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'profiles' 
                     AND column_name = 'stripe_customer_id') THEN
          ALTER TABLE public.profiles ADD COLUMN stripe_customer_id TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'profiles' 
                     AND column_name = 'is_subscribed') THEN
          ALTER TABLE public.profiles ADD COLUMN is_subscribed BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'profiles' 
                     AND column_name = 'payment_status') THEN
          ALTER TABLE public.profiles ADD COLUMN payment_status TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'profiles' 
                     AND column_name = 'last_payment_id') THEN
          ALTER TABLE public.profiles ADD COLUMN last_payment_id TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'profiles' 
                     AND column_name = 'last_payment_status') THEN
          ALTER TABLE public.profiles ADD COLUMN last_payment_status TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'profiles' 
                     AND column_name = 'last_payment_date') THEN
          ALTER TABLE public.profiles ADD COLUMN last_payment_date TIMESTAMP WITH TIME ZONE;
        END IF;
      END IF;
    END $$;

    -- Criar gatilho para atualizar timestamp em atualizações
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'set_updated_at') THEN
        CREATE OR REPLACE FUNCTION public.set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
        
        RAISE NOTICE 'Gatilho set_updated_at criado com sucesso';
      END IF;
    END $$;

    -- Criar função para inserir perfil
    CREATE OR REPLACE FUNCTION insert_profile(
      user_id UUID,
      user_email TEXT,
      customer_id TEXT DEFAULT NULL,
      payment_id TEXT DEFAULT NULL
    )
    RETURNS boolean AS $$
    BEGIN
      -- Inserir ou atualizar o perfil
      INSERT INTO public.profiles (
        id,
        email,
        stripe_customer_id,
        payment_status,
        is_subscribed,
        last_payment_id,
        last_payment_status,
        last_payment_date
      ) VALUES (
        user_id,
        user_email,
        customer_id,
        CASE WHEN payment_id IS NOT NULL THEN 'paid' ELSE NULL END,
        CASE WHEN payment_id IS NOT NULL THEN true ELSE false END,
        payment_id,
        CASE WHEN payment_id IS NOT NULL THEN 'paid' ELSE NULL END,
        CASE WHEN payment_id IS NOT NULL THEN now() ELSE NULL END
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, profiles.stripe_customer_id),
        payment_status = COALESCE(EXCLUDED.payment_status, profiles.payment_status),
        is_subscribed = COALESCE(EXCLUDED.is_subscribed, profiles.is_subscribed),
        last_payment_id = COALESCE(EXCLUDED.last_payment_id, profiles.last_payment_id),
        last_payment_status = COALESCE(EXCLUDED.last_payment_status, profiles.last_payment_status),
        last_payment_date = COALESCE(EXCLUDED.last_payment_date, profiles.last_payment_date),
        updated_at = now();

      RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql;

    -- Conceder permissões para a função
    GRANT EXECUTE ON FUNCTION insert_profile(UUID, TEXT, TEXT, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION insert_profile(UUID, TEXT, TEXT, TEXT) TO anon;
    GRANT EXECUTE ON FUNCTION insert_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
    `;

    // Executar o SQL via RPC
    try {
      const { error: sqlError } = await supabase.rpc('pgexecute', { query: createTableSQL });
      
      if (sqlError) {
        console.error(`[ERROR] Erro ao executar SQL via RPC: ${sqlError.message}`);
        
        // Método alternativo: executar direto no banco (mais arriscado e menos portável)
        console.log("[INFO] Tentando método alternativo...");
        
        // Verificar se auth.users existe (validação básica)
        const { data: authCheck, error: authError } = await supabase
          .from('_pgrst_auth')
          .select('*')
          .limit(1);
          
        if (authError) {
          console.log("[INFO] Sem acesso a tabelas de sistema, executando direto...");
          
          // Dividir o script em partes menores
          const statements = [
            `CREATE TABLE IF NOT EXISTS public.profiles (
              id UUID PRIMARY KEY,
              email TEXT NOT NULL,
              full_name TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              stripe_customer_id TEXT,
              payment_status TEXT,
              is_subscribed BOOLEAN DEFAULT FALSE,
              last_payment_id TEXT,
              last_payment_status TEXT,
              last_payment_date TIMESTAMP WITH TIME ZONE
            );`,
            
            `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`,
            
            `CREATE OR REPLACE FUNCTION insert_profile(
              user_id UUID,
              user_email TEXT,
              customer_id TEXT,
              payment_id TEXT
            )
            RETURNS boolean AS $$
            BEGIN
              INSERT INTO public.profiles (
                id, email, stripe_customer_id, payment_status, is_subscribed, 
                last_payment_id, last_payment_status, last_payment_date
              ) VALUES (
                user_id, user_email, customer_id, 'paid', true,
                payment_id, 'paid', now()
              )
              ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, profiles.stripe_customer_id),
                payment_status = COALESCE(EXCLUDED.payment_status, profiles.payment_status),
                is_subscribed = COALESCE(EXCLUDED.is_subscribed, profiles.is_subscribed),
                last_payment_id = COALESCE(EXCLUDED.last_payment_id, profiles.last_payment_id),
                last_payment_status = COALESCE(EXCLUDED.last_payment_status, profiles.last_payment_status),
                last_payment_date = COALESCE(EXCLUDED.last_payment_date, profiles.last_payment_date),
                updated_at = now();
              RETURN TRUE;
            END;
            $$ LANGUAGE plpgsql;`
          ];
          
          for (const stmt of statements) {
            try {
              await supabase.rpc('pgexecute', { query: stmt }).catch(() => {
                console.log(`[INFO] Ignorando erro na execução de parte do script...`);
              });
            } catch (e) {
              console.log(`[INFO] Erro ignorado: ${e.message}`);
            }
          }
        }
      } else {
        console.log("[SUCCESS] SQL executado com sucesso!");
      }
    } catch (rpcError) {
      console.error(`[ERROR] Falha ao chamar RPC: ${rpcError.message}`);
    }
    
    // Verificação final: testar se a tabela existe
    let tableExists = false;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (!error) {
        tableExists = true;
        console.log("[SUCCESS] Tabela profiles verificada com sucesso!");
      } else {
        console.error(`[ERROR] Erro ao verificar tabela: ${error.message}`);
      }
    } catch (checkError) {
      console.error(`[ERROR] Falha ao verificar tabela: ${checkError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        tableExists: tableExists,
        message: "Verificação da tabela profiles concluída"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error(`[ERROR] Erro geral: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Erro ao verificar/criar tabela profiles",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}); 