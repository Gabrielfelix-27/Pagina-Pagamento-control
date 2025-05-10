import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

console.log("Função create-profiles-table inicializada");

serve(async (req) => {
  // Lidar com requisições OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Inicializar cliente Supabase com chave de serviço
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Verificando/criando tabela profiles...");

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

        RAISE NOTICE 'Tabela profiles criada com sucesso';
      ELSE
        RAISE NOTICE 'Tabela profiles já existe';
      END IF;
    END $$;

    -- Criar gatilho para updated_at
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.profiles'::regclass) THEN
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
      customer_id TEXT,
      payment_id TEXT
    )
    RETURNS boolean AS $$
    BEGIN
      -- Inserir ou atualizar o perfil
      INSERT INTO public.profiles (
        id,
        email,
        stripe_customer_id,
        payment_status,
        subscription_status,
        is_subscribed,
        last_payment_id,
        last_payment_status,
        last_payment_date
      ) VALUES (
        user_id,
        user_email,
        customer_id,
        'paid',
        'active',
        true,
        payment_id,
        'paid',
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        payment_status = EXCLUDED.payment_status,
        subscription_status = EXCLUDED.subscription_status,
        is_subscribed = EXCLUDED.is_subscribed,
        last_payment_id = EXCLUDED.last_payment_id,
        last_payment_status = EXCLUDED.last_payment_status,
        last_payment_date = EXCLUDED.last_payment_date,
        updated_at = now();

      RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql;

    -- Conceder permissões
    GRANT EXECUTE ON FUNCTION insert_profile(UUID, TEXT, TEXT, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION insert_profile(UUID, TEXT, TEXT, TEXT) TO anon;
    GRANT EXECUTE ON FUNCTION insert_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
    `;

    // Executar o SQL
    const { error } = await supabase.rpc('pgexecute', { query: createTableSQL });

    if (error) {
      console.error("Erro ao criar tabela profiles:", error);
      return new Response(
        JSON.stringify({ 
          error: true, 
          message: "Erro ao criar tabela profiles", 
          details: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Verificar se a tabela foi criada com sucesso
    const { data, error: checkError } = await supabase
      .from('profiles')
      .select('count(*)', { count: 'exact', head: true });

    if (checkError) {
      console.error("Erro ao verificar tabela profiles:", checkError);
      return new Response(
        JSON.stringify({ 
          error: true, 
          message: "Erro ao verificar tabela profiles", 
          details: checkError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Tabela profiles verificada/criada com sucesso",
        data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        error: true, 
        message: "Erro ao processar a requisição", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}); 