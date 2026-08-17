export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      atividades: {
        Row: {
          criado_em: string | null
          descricao: string
          id: string
          metadata: Json | null
          numero: number | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string | null
          descricao: string
          id?: string
          metadata?: Json | null
          numero?: number | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string | null
          descricao?: string
          id?: string
          metadata?: Json | null
          numero?: number | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          criado_em: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string
          id: string
          ip_address: string | null
          local: string | null
          menu: string
          numero: number | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          acao: string
          criado_em?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao: string
          id?: string
          ip_address?: string | null
          local?: string | null
          menu: string
          numero?: number | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          acao?: string
          criado_em?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string
          id?: string
          ip_address?: string | null
          local?: string | null
          menu?: string
          numero?: number | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: []
      }
      avaliacoes_treinamentos: {
        Row: {
          atualizado_em: string
          comentario: string | null
          criado_em: string
          id: string
          nota: number
          numero: number | null
          treinamento_id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          comentario?: string | null
          criado_em?: string
          id?: string
          nota: number
          numero?: number | null
          treinamento_id: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          comentario?: string | null
          criado_em?: string
          id?: string
          nota?: number
          numero?: number | null
          treinamento_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_treinamentos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_popup: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          departamento_id: string | null
          eh_aniversario: boolean
          empresa_id: string | null
          id: string
          midia_url: string | null
          publico_tipo: string
          recorrencia: string
          texto_conteudo: string | null
          tipo_conteudo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          departamento_id?: string | null
          eh_aniversario?: boolean
          empresa_id?: string | null
          id?: string
          midia_url?: string | null
          publico_tipo?: string
          recorrencia: string
          texto_conteudo?: string | null
          tipo_conteudo: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          departamento_id?: string | null
          eh_aniversario?: boolean
          empresa_id?: string | null
          id?: string
          midia_url?: string | null
          publico_tipo?: string
          recorrencia?: string
          texto_conteudo?: string | null
          tipo_conteudo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_popup_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_popup_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_popup_usuarios: {
        Row: {
          aviso_id: string
          criado_em: string
          id: string
          usuario_id: string
        }
        Insert: {
          aviso_id: string
          criado_em?: string
          id?: string
          usuario_id: string
        }
        Update: {
          aviso_id?: string
          criado_em?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_popup_usuarios_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos_popup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_popup_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_popup_visualizacoes: {
        Row: {
          aviso_id: string
          data_visualizacao: string
          id: string
          usuario_id: string
          visualizado_em: string
        }
        Insert: {
          aviso_id: string
          data_visualizacao?: string
          id?: string
          usuario_id: string
          visualizado_em?: string
        }
        Update: {
          aviso_id?: string
          data_visualizacao?: string
          id?: string
          usuario_id?: string
          visualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_popup_visualizacoes_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos_popup"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          numero: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          numero?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          numero: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          numero?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpj_demo_usado: {
        Row: {
          cnpj: string
          criado_em: string
          empresa_id: string | null
          id: string
          numero: number | null
          usado_em: string
        }
        Insert: {
          cnpj: string
          criado_em?: string
          empresa_id?: string | null
          id?: string
          numero?: number | null
          usado_em?: string
        }
        Update: {
          cnpj?: string
          criado_em?: string
          empresa_id?: string | null
          id?: string
          numero?: number | null
          usado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnpj_demo_usado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_ia_empresa: {
        Row: {
          api_key: string | null
          api_key_chatgpt: string | null
          api_key_deepseek: string | null
          api_key_gemini: string | null
          atualizado_em: string | null
          criado_em: string | null
          empresa_id: string
          habilitado: boolean | null
          id: string
          modelo_ia: string | null
          numero: number | null
          provedor_ia: string
        }
        Insert: {
          api_key?: string | null
          api_key_chatgpt?: string | null
          api_key_deepseek?: string | null
          api_key_gemini?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id: string
          habilitado?: boolean | null
          id?: string
          modelo_ia?: string | null
          numero?: number | null
          provedor_ia?: string
        }
        Update: {
          api_key?: string | null
          api_key_chatgpt?: string | null
          api_key_deepseek?: string | null
          api_key_gemini?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id?: string
          habilitado?: boolean | null
          id?: string
          modelo_ia?: string | null
          numero?: number | null
          provedor_ia?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_ia_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_menu: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          field_config: Json | null
          id: string
          menu_config: Json | null
          report_layout: Json | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          field_config?: Json | null
          id?: string
          menu_config?: Json | null
          report_layout?: Json | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          field_config?: Json | null
          id?: string
          menu_config?: Json | null
          report_layout?: Json | null
        }
        Relationships: []
      }
      configuracoes_sistema: {
        Row: {
          atualizado_em: string | null
          backup_config: Json
          backup_destino: string
          bloqueio_horas: number
          favicon_url: string | null
          id: string
          logo_sidebar_url: string | null
          logoff_on_close: boolean
          nome_sistema: string
          numero: number | null
          session_timeout_min: number
          tentativas_login_max: number
        }
        Insert: {
          atualizado_em?: string | null
          backup_config?: Json
          backup_destino?: string
          bloqueio_horas?: number
          favicon_url?: string | null
          id?: string
          logo_sidebar_url?: string | null
          logoff_on_close?: boolean
          nome_sistema?: string
          numero?: number | null
          session_timeout_min?: number
          tentativas_login_max?: number
        }
        Update: {
          atualizado_em?: string | null
          backup_config?: Json
          backup_destino?: string
          bloqueio_horas?: number
          favicon_url?: string | null
          id?: string
          logo_sidebar_url?: string | null
          logoff_on_close?: boolean
          nome_sistema?: string
          numero?: number | null
          session_timeout_min?: number
          tentativas_login_max?: number
        }
        Relationships: []
      }
      departamentos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          numero: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          numero?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bloqueada: boolean | null
          cnpj: string | null
          criado_em: string | null
          data_bloqueio: string | null
          data_contratacao: string | null
          demo_created_at: string | null
          demo_expires_at: string | null
          email: string | null
          endereco: string | null
          id: string
          is_demo: boolean | null
          logo_url: string | null
          motivo_bloqueio: string | null
          nome: string
          nome_fantasia: string | null
          numero: number | null
          plano_id: string | null
          razao_social: string | null
          responsavel: string | null
          telefone: string | null
          tema_cor: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bloqueada?: boolean | null
          cnpj?: string | null
          criado_em?: string | null
          data_bloqueio?: string | null
          data_contratacao?: string | null
          demo_created_at?: string | null
          demo_expires_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          is_demo?: boolean | null
          logo_url?: string | null
          motivo_bloqueio?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: number | null
          plano_id?: string | null
          razao_social?: string | null
          responsavel?: string | null
          telefone?: string | null
          tema_cor?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bloqueada?: boolean | null
          cnpj?: string | null
          criado_em?: string | null
          data_bloqueio?: string | null
          data_contratacao?: string | null
          demo_created_at?: string | null
          demo_expires_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          is_demo?: boolean | null
          logo_url?: string | null
          motivo_bloqueio?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: number | null
          plano_id?: string | null
          razao_social?: string | null
          responsavel?: string | null
          telefone?: string | null
          tema_cor?: string | null
        }
        Relationships: []
      }
      landing_page_config: {
        Row: {
          atualizado_em: string | null
          company_description: string | null
          company_name: string | null
          criado_em: string | null
          cta_subtitle: string | null
          cta_title: string | null
          custom_css: string | null
          featured_trainings_enabled: boolean | null
          features_section: Json | null
          footer_section: Json
          hero_background_color: string | null
          hero_badge: string | null
          hero_cta_primary: string | null
          hero_cta_secondary: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          logo_url: string | null
          numero: number | null
          sections_alignment: Json
          sections_order: Json
          show_annual_toggle: boolean | null
          sobre_nos: string | null
          stats_section: Json | null
          termos_de_uso: string | null
        }
        Insert: {
          atualizado_em?: string | null
          company_description?: string | null
          company_name?: string | null
          criado_em?: string | null
          cta_subtitle?: string | null
          cta_title?: string | null
          custom_css?: string | null
          featured_trainings_enabled?: boolean | null
          features_section?: Json | null
          footer_section?: Json
          hero_background_color?: string | null
          hero_badge?: string | null
          hero_cta_primary?: string | null
          hero_cta_secondary?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          numero?: number | null
          sections_alignment?: Json
          sections_order?: Json
          show_annual_toggle?: boolean | null
          sobre_nos?: string | null
          stats_section?: Json | null
          termos_de_uso?: string | null
        }
        Update: {
          atualizado_em?: string | null
          company_description?: string | null
          company_name?: string | null
          criado_em?: string | null
          cta_subtitle?: string | null
          cta_title?: string | null
          custom_css?: string | null
          featured_trainings_enabled?: boolean | null
          features_section?: Json | null
          footer_section?: Json
          hero_background_color?: string | null
          hero_badge?: string | null
          hero_cta_primary?: string | null
          hero_cta_secondary?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          numero?: number | null
          sections_alignment?: Json
          sections_order?: Json
          show_annual_toggle?: boolean | null
          sobre_nos?: string | null
          stats_section?: Json | null
          termos_de_uso?: string | null
        }
        Relationships: []
      }
      lembretes: {
        Row: {
          cor: string | null
          criado_em: string | null
          criado_por_role: string | null
          data_lembrete: string
          descricao: string | null
          evento_id: string | null
          id: string
          notificado: boolean | null
          numero: number | null
          tipo: string
          titulo: string
          treinamento_id: string | null
          usuario_id: string
        }
        Insert: {
          cor?: string | null
          criado_em?: string | null
          criado_por_role?: string | null
          data_lembrete: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          notificado?: boolean | null
          numero?: number | null
          tipo?: string
          titulo: string
          treinamento_id?: string | null
          usuario_id: string
        }
        Update: {
          cor?: string | null
          criado_em?: string | null
          criado_por_role?: string | null
          data_lembrete?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          notificado?: boolean | null
          numero?: number | null
          tipo?: string
          titulo?: string
          treinamento_id?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          atualizado_em: string | null
          contrato_id: string | null
          criado_em: string | null
          data_pagamento: string | null
          data_vencimento: string
          empresa_id: string
          id: string
          metodo_pagamento: string | null
          numero: number | null
          observacoes: string | null
          referencia: string | null
          status: string
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          empresa_id: string
          id?: string
          metodo_pagamento?: string | null
          numero?: number | null
          observacoes?: string | null
          referencia?: string | null
          status?: string
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: string
          id?: string
          metodo_pagamento?: string | null
          numero?: number | null
          observacoes?: string | null
          referencia?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "plano_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          avatar_url: string | null
          cargo: string | null
          criado_em: string | null
          data_nascimento: string | null
          data_proxima_troca_senha: string | null
          data_ultima_troca_senha: string | null
          departamento_id: string | null
          dias_para_trocar_senha: number | null
          email: string
          empresa_id: string | null
          id: string
          nome: string
          numero: number | null
          telefone: string | null
          trocar_senha_primeiro_login: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          avatar_url?: string | null
          cargo?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          data_proxima_troca_senha?: string | null
          data_ultima_troca_senha?: string | null
          departamento_id?: string | null
          dias_para_trocar_senha?: number | null
          email: string
          empresa_id?: string | null
          id: string
          nome: string
          numero?: number | null
          telefone?: string | null
          trocar_senha_primeiro_login?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          avatar_url?: string | null
          cargo?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          data_proxima_troca_senha?: string | null
          data_ultima_troca_senha?: string | null
          departamento_id?: string | null
          dias_para_trocar_senha?: number | null
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          numero?: number | null
          telefone?: string | null
          trocar_senha_primeiro_login?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_role: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          empresa_id: string | null
          id: string
          permissao_id: string
          role: Database["public"]["Enums"]["tipo_role"]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string | null
          id?: string
          permissao_id: string
          role: Database["public"]["Enums"]["tipo_role"]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string | null
          id?: string
          permissao_id?: string
          role?: Database["public"]["Enums"]["tipo_role"]
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_role_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contratos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          limite_armazenamento_gb: number | null
          limite_treinamentos: number
          limite_usuarios: number
          nome_plano: string
          numero: number | null
          plano_id: string | null
          preco_contratado: number
          recursos_contratados: Json | null
          treinamentos_extras: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          id?: string
          limite_armazenamento_gb?: number | null
          limite_treinamentos: number
          limite_usuarios: number
          nome_plano: string
          numero?: number | null
          plano_id?: string | null
          preco_contratado: number
          recursos_contratados?: Json | null
          treinamentos_extras?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          limite_armazenamento_gb?: number | null
          limite_treinamentos?: number
          limite_usuarios?: number
          nome_plano?: string
          numero?: number | null
          plano_id?: string | null
          preco_contratado?: number
          recursos_contratados?: Json | null
          treinamentos_extras?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_contratos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          icone: string | null
          id: string
          limite_armazenamento_gb: number | null
          limite_treinamentos: number
          limite_usuarios: number
          nome: string
          numero: number | null
          ordem: number | null
          periodo: string | null
          popular: boolean | null
          preco: number
          recursos: Json | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          limite_armazenamento_gb?: number | null
          limite_treinamentos?: number
          limite_usuarios?: number
          nome: string
          numero?: number | null
          ordem?: number | null
          periodo?: string | null
          popular?: boolean | null
          preco?: number
          recursos?: Json | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          limite_armazenamento_gb?: number | null
          limite_treinamentos?: number
          limite_usuarios?: number
          nome?: string
          numero?: number | null
          ordem?: number | null
          periodo?: string | null
          popular?: boolean | null
          preco?: number
          recursos?: Json | null
        }
        Relationships: []
      }
      progresso_treinamentos: {
        Row: {
          atualizado_em: string | null
          concluido: boolean | null
          criado_em: string | null
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          nota_avaliacao: number | null
          numero: number | null
          percentual_concluido: number | null
          tempo_assistido_minutos: number | null
          treinamento_id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          concluido?: boolean | null
          criado_em?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          nota_avaliacao?: number | null
          numero?: number | null
          percentual_concluido?: number | null
          tempo_assistido_minutos?: number | null
          treinamento_id: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          concluido?: boolean | null
          criado_em?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          nota_avaliacao?: number | null
          numero?: number | null
          percentual_concluido?: number | null
          tempo_assistido_minutos?: number | null
          treinamento_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progresso_treinamentos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          atualizado_em: string
          auth: string
          criado_em: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          auth: string
          criado_em?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          auth?: string
          criado_em?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      questoes_treinamento: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          numero: number | null
          opcao_a: string
          opcao_b: string
          opcao_c: string | null
          opcao_d: string | null
          opcoes: Json | null
          ordem: number
          passo: number | null
          pergunta: string
          resposta_correta: string
          tipo: string
          treinamento_id: string
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          numero?: number | null
          opcao_a: string
          opcao_b: string
          opcao_c?: string | null
          opcao_d?: string | null
          opcoes?: Json | null
          ordem?: number
          passo?: number | null
          pergunta: string
          resposta_correta?: string
          tipo?: string
          treinamento_id: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          numero?: number | null
          opcao_a?: string
          opcao_b?: string
          opcao_c?: string | null
          opcao_d?: string | null
          opcoes?: Json | null
          ordem?: number
          passo?: number | null
          pergunta?: string
          resposta_correta?: string
          tipo?: string
          treinamento_id?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_treinamento_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_configuracoes: {
        Row: {
          api_id: string | null
          api_key: string | null
          api_key_configurada: boolean
          ativo: boolean
          atualizado_em: string
          criado_em: string
          empresa_id: string | null
          id: string
          modo_teste: boolean
          provedor: string
          remetente: string | null
        }
        Insert: {
          api_id?: string | null
          api_key?: string | null
          api_key_configurada?: boolean
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string | null
          id?: string
          modo_teste?: boolean
          provedor?: string
          remetente?: string | null
        }
        Update: {
          api_id?: string | null
          api_key?: string | null
          api_key_configurada?: boolean
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string | null
          id?: string
          modo_teste?: boolean
          provedor?: string
          remetente?: string | null
        }
        Relationships: []
      }
      sms_envios: {
        Row: {
          criado_em: string
          empresa_id: string | null
          enviado_em: string | null
          erro: string | null
          gatilho: string
          id: string
          mensagem: string
          resposta_provedor: Json
          status: string
          telefone: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          empresa_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          gatilho: string
          id?: string
          mensagem: string
          resposta_provedor?: Json
          status?: string
          telefone: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          empresa_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          gatilho?: string
          id?: string
          mensagem?: string
          resposta_provedor?: Json
          status?: string
          telefone?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      sms_gatilhos: {
        Row: {
          antecedencia_minutos: number | null
          ativo: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          template: string
        }
        Insert: {
          antecedencia_minutos?: number | null
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          template: string
        }
        Update: {
          antecedencia_minutos?: number | null
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          template?: string
        }
        Relationships: []
      }
      tentativas_avaliacao: {
        Row: {
          aprovado: boolean
          criado_em: string | null
          duracao_segundos: number | null
          id: string
          nota: number
          numero: number | null
          numero_tentativa: number | null
          respostas: Json
          tempo_estudo_segundos: number | null
          treinamento_id: string
          usuario_id: string
        }
        Insert: {
          aprovado?: boolean
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          nota?: number
          numero?: number | null
          numero_tentativa?: number | null
          respostas?: Json
          tempo_estudo_segundos?: number | null
          treinamento_id: string
          usuario_id: string
        }
        Update: {
          aprovado?: boolean
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          nota?: number
          numero?: number | null
          numero_tentativa?: number | null
          respostas?: Json
          tempo_estudo_segundos?: number | null
          treinamento_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tentativas_avaliacao_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      tentativas_eventos: {
        Row: {
          criado_em: string
          detalhes: Json | null
          id: string
          tipo_evento: string
          treinamento_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          detalhes?: Json | null
          id?: string
          tipo_evento: string
          treinamento_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          detalhes?: Json | null
          id?: string
          tipo_evento?: string
          treinamento_id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      tentativas_login: {
        Row: {
          criado_em: string
          email: string
          id: string
          ip: string | null
          sucesso: boolean
          user_agent: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          ip?: string | null
          sucesso?: boolean
          user_agent?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          ip?: string | null
          sucesso?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      treinamentos: {
        Row: {
          atualizado_em: string | null
          avaliacao_obrigatoria: boolean | null
          categoria: string | null
          conteudo_html: string | null
          criado_em: string | null
          data_limite: string | null
          departamento_id: string | null
          descricao: string | null
          duracao_minutos: number | null
          empresa_id: string | null
          id: string
          instrutor_id: string | null
          media_avaliacao: number | null
          nivel: string | null
          nota_minima: number | null
          numero: number | null
          obrigatorio: boolean | null
          publicado: boolean | null
          tempo_avaliacao_minutos: number | null
          thumbnail_url: string | null
          titulo: string
          total_avaliacoes: number | null
        }
        Insert: {
          atualizado_em?: string | null
          avaliacao_obrigatoria?: boolean | null
          categoria?: string | null
          conteudo_html?: string | null
          criado_em?: string | null
          data_limite?: string | null
          departamento_id?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          instrutor_id?: string | null
          media_avaliacao?: number | null
          nivel?: string | null
          nota_minima?: number | null
          numero?: number | null
          obrigatorio?: boolean | null
          publicado?: boolean | null
          tempo_avaliacao_minutos?: number | null
          thumbnail_url?: string | null
          titulo: string
          total_avaliacoes?: number | null
        }
        Update: {
          atualizado_em?: string | null
          avaliacao_obrigatoria?: boolean | null
          categoria?: string | null
          conteudo_html?: string | null
          criado_em?: string | null
          data_limite?: string | null
          departamento_id?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          empresa_id?: string | null
          id?: string
          instrutor_id?: string | null
          media_avaliacao?: number | null
          nivel?: string | null
          nota_minima?: number | null
          numero?: number | null
          obrigatorio?: boolean | null
          publicado?: boolean | null
          tempo_avaliacao_minutos?: number | null
          thumbnail_url?: string | null
          titulo?: string
          total_avaliacoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      uso_empresa: {
        Row: {
          armazenamento_usado_mb: number | null
          atualizado_em: string | null
          empresa_id: string
          id: string
          numero: number | null
          treinamentos_criados: number | null
          usuarios_ativos: number | null
        }
        Insert: {
          armazenamento_usado_mb?: number | null
          atualizado_em?: string | null
          empresa_id: string
          id?: string
          numero?: number | null
          treinamentos_criados?: number | null
          usuarios_ativos?: number | null
        }
        Update: {
          armazenamento_usado_mb?: number | null
          atualizado_em?: string | null
          empresa_id?: string
          id?: string
          numero?: number | null
          treinamentos_criados?: number | null
          usuarios_ativos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uso_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_roles: {
        Row: {
          criado_em: string | null
          id: string
          numero: number | null
          role: Database["public"]["Enums"]["tipo_role"]
          usuario_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          numero?: number | null
          role?: Database["public"]["Enums"]["tipo_role"]
          usuario_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          numero?: number | null
          role?: Database["public"]["Enums"]["tipo_role"]
          usuario_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copiar_modelos_para_empresa: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      corrigir_avaliacao: {
        Args: {
          p_duracao_segundos: number
          p_nota_minima?: number
          p_respostas: Json
          p_tempo_estudo_segundos: number
          p_treinamento_id: string
        }
        Returns: Json
      }
      criar_contrato_plano: {
        Args: { p_empresa_id: string; p_plano_id: string }
        Returns: string
      }
      eh_admin_ou_master: { Args: { usuario_id: string }; Returns: boolean }
      get_empresa_id_do_usuario: {
        Args: { p_user_id: string }
        Returns: string
      }
      listar_usuarios_visiveis_admin: {
        Args: never
        Returns: {
          ativo: boolean
          cargo: string
          data_nascimento: string
          departamento_id: string
          dias_para_trocar_senha: number
          email: string
          empresa_id: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["tipo_role"]
          trocar_senha_primeiro_login: boolean
        }[]
      }
      mesma_empresa_que_usuario: {
        Args: { p_usuario_alvo: string }
        Returns: boolean
      }
      obter_avisos_popup_pendentes: {
        Args: never
        Returns: {
          eh_aniversario: boolean
          id: string
          midia_url: string
          texto_conteudo: string
          tipo_conteudo: string
          titulo: string
        }[]
      }
      obter_config_sistema_publica: {
        Args: never
        Returns: {
          favicon_url: string
          logo_sidebar_url: string
          logoff_on_close: boolean
          nome_sistema: string
          session_timeout_min: number
        }[]
      }
      obter_questoes_avaliacao: {
        Args: { p_treinamento_id: string }
        Returns: {
          id: string
          opcao_a: string
          opcao_b: string
          opcao_c: string
          opcao_d: string
          opcoes: Json
          ordem: number
          passo: number
          pergunta: string
          tipo: string
          treinamento_id: string
          valor_maximo: number
          valor_minimo: number
        }[]
      }
      pode_gerenciar_usuario_alvo: {
        Args: { p_usuario_alvo: string }
        Returns: boolean
      }
      pode_tentar_login: { Args: { p_email: string }; Returns: Json }
      registrar_cnpj_demo: {
        Args: { p_cnpj: string; p_empresa_id: string }
        Returns: undefined
      }
      registrar_tentativa_login: {
        Args: { p_email: string; p_sucesso: boolean }
        Returns: undefined
      }
      verificar_cnpj_demo_disponivel: {
        Args: { p_cnpj: string }
        Returns: boolean
      }
      verificar_demo_expirada: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      verificar_limite_treinamentos: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      verificar_limite_usuarios: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      verificar_role: {
        Args: {
          _role: Database["public"]["Enums"]["tipo_role"]
          usuario_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      tipo_role: "master" | "admin" | "instrutor" | "usuario"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      tipo_role: ["master", "admin", "instrutor", "usuario"],
    },
  },
} as const
