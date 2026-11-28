export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          admin_id: string;
          created_at: string;
          details: Json;
          id: string;
          reason: string | null;
          target: string | null;
        };
        Insert: {
          action: string;
          admin_id: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string | null;
          target?: string | null;
        };
        Update: {
          action?: string;
          admin_id?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string | null;
          target?: string | null;
        };
        Relationships: [];
      };
      ai_budget_days: {
        Row: {
          day: string;
          held_and_spent_usd: number;
          reserved_usd: number;
          spent_usd: number;
        };
        Insert: {
          day: string;
          held_and_spent_usd?: number;
          reserved_usd?: number;
          spent_usd?: number;
        };
        Update: {
          day?: string;
          held_and_spent_usd?: number;
          reserved_usd?: number;
          spent_usd?: number;
        };
        Relationships: [];
      };
      ai_model_rates: {
        Row: {
          audio_per_minute_usd: number;
          cached_input_per_million_usd: number;
          input_per_million_usd: number;
          model: string;
          output_per_million_usd: number;
          processing_mode: string;
          provider: string;
          updated_at: string;
          updated_by: string | null;
          write_per_million_usd: number;
        };
        Insert: {
          audio_per_minute_usd?: number;
          cached_input_per_million_usd?: number;
          input_per_million_usd?: number;
          model: string;
          output_per_million_usd?: number;
          processing_mode?: string;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
          write_per_million_usd?: number;
        };
        Update: {
          audio_per_minute_usd?: number;
          cached_input_per_million_usd?: number;
          input_per_million_usd?: number;
          model?: string;
          output_per_million_usd?: number;
          processing_mode?: string;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
          write_per_million_usd?: number;
        };
        Relationships: [];
      };
      ai_request_cache: {
        Row: {
          created_at: string;
          expires_at: string;
          feature: string | null;
          hit_count: number;
          hits: number;
          id: string;
          input_hash: string;
          key: string | null;
          kind: string;
          lease: string | null;
          reservation_id: string | null;
          result: Json | null;
          source_reservation: string | null;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          feature?: string | null;
          hit_count?: number;
          hits?: number;
          id?: string;
          input_hash: string;
          key?: string | null;
          kind: string;
          lease?: string | null;
          reservation_id?: string | null;
          result?: Json | null;
          source_reservation?: string | null;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          feature?: string | null;
          hit_count?: number;
          hits?: number;
          id?: string;
          input_hash?: string;
          key?: string | null;
          kind?: string;
          lease?: string | null;
          reservation_id?: string | null;
          result?: Json | null;
          source_reservation?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_request_cache_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "operation_reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_request_cache_source_reservation_fkey";
            columns: ["source_reservation"];
            isOneToOne: false;
            referencedRelation: "operation_reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_request_cache_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_request_cache_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_reuse_days: {
        Row: {
          day: string;
          feature: string;
          hits: number;
          savings_usd: number;
          unpriced_hits: number;
          user_id: string;
        };
        Insert: {
          day: string;
          feature: string;
          hits: number;
          savings_usd: number;
          unpriced_hits: number;
          user_id: string;
        };
        Update: {
          day?: string;
          feature?: string;
          hits?: number;
          savings_usd?: number;
          unpriced_hits?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_usage_log: {
        Row: {
          audio_seconds: number;
          cost_usd: number;
          created_at: string;
          error: string | null;
          feature: string;
          id: string;
          input_tokens: number;
          latency_ms: number | null;
          model: string;
          ok: boolean;
          output_tokens: number;
          reservation_id: string | null;
          usage_details: Json;
          user_id: string | null;
          workspace_id: string | null;
        };
        Insert: {
          audio_seconds?: number;
          cost_usd?: number;
          created_at?: string;
          error?: string | null;
          feature: string;
          id?: string;
          input_tokens?: number;
          latency_ms?: number | null;
          model: string;
          ok?: boolean;
          output_tokens?: number;
          reservation_id?: string | null;
          usage_details?: Json;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          audio_seconds?: number;
          cost_usd?: number;
          created_at?: string;
          error?: string | null;
          feature?: string;
          id?: string;
          input_tokens?: number;
          latency_ms?: number | null;
          model?: string;
          ok?: boolean;
          output_tokens?: number;
          reservation_id?: string | null;
          usage_details?: Json;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "operation_reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at: string;
          id: string;
          last_error: string | null;
          last_sync_at: string | null;
          last_sync_count: number;
          reconnect_required: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          last_sync_count?: number;
          reconnect_required?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_key_ciphertext?: string;
          connector_id?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          last_sync_count?: number;
          reconnect_required?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      billing_action_locks: {
        Row: {
          action_key: string;
          expires_at: string;
          token: string;
        };
        Insert: {
          action_key: string;
          expires_at: string;
          token: string;
        };
        Update: {
          action_key?: string;
          expires_at?: string;
          token?: string;
        };
        Relationships: [];
      };
      checkout_voucher_holds: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          plan: string;
          environment: string;
          billing_interval: string;
          terms: Json;
          legacy_id: string | null;
          state: string;
          expires_at: string;
          session_id: string | null;
          coupon_id: string | null;
          target_subscription: string | null;
        };
        Insert: never;
        Update: { target_subscription?: string; coupon_id?: string };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          created_at: string;
          customer_id: string;
          environment: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          environment: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          environment?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      billing_events: {
        Row: {
          created_at: string;
          event_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
        };
        Relationships: [];
      };
      billing_price_history: {
        Row: {
          amount: number;
          environment: string;
          interval_name: string;
          plan_key: string;
          price_id: string;
          product_id: string;
        };
        Insert: {
          amount: number;
          environment: string;
          interval_name: string;
          plan_key: string;
          price_id: string;
          product_id: string;
        };
        Update: {
          amount?: number;
          environment?: string;
          interval_name?: string;
          plan_key?: string;
          price_id?: string;
          product_id?: string;
        };
        Relationships: [];
      };
      evidence_files: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          mime: string;
          name: string;
          path: string;
          size: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          mime?: string;
          name: string;
          path: string;
          size?: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          mime?: string;
          name?: string;
          path?: string;
          size?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_files_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "home_items";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          audiences: string[];
          created_at: string;
          description: string;
          enabled: boolean;
          key: string;
          name: string;
          rollout: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          audiences?: string[];
          created_at?: string;
          description?: string;
          enabled?: boolean;
          key: string;
          name: string;
          rollout?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          audiences?: string[];
          created_at?: string;
          description?: string;
          enabled?: boolean;
          key?: string;
          name?: string;
          rollout?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      google_sync_links: {
        Row: {
          connector_id: string;
          created_at: string;
          external_id: string;
          google_id: string | null;
          id: string;
          item_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connector_id: string;
          created_at?: string;
          external_id: string;
          google_id?: string | null;
          id?: string;
          item_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connector_id?: string;
          created_at?: string;
          external_id?: string;
          google_id?: string | null;
          id?: string;
          item_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      health_checks: {
        Row: {
          created_at: string;
          detail: string | null;
          id: string;
          latency_ms: number | null;
          ok: boolean;
          service: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          latency_ms?: number | null;
          ok: boolean;
          service: string;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          latency_ms?: number | null;
          ok?: boolean;
          service?: string;
        };
        Relationships: [];
      };
      home_items: {
        Row: {
          created_at: string;
          fields: Json;
          id: string;
          property_id: string | null;
          section: string;
          subtitle: string;
          title: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          fields?: Json;
          id?: string;
          property_id?: string | null;
          section: string;
          subtitle?: string;
          title: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          fields?: Json;
          id?: string;
          property_id?: string | null;
          section?: string;
          subtitle?: string;
          title?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "home_items_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "home_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "home_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      infra_costs: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          id: string;
          period_month: string;
          provider: string;
          source: string;
        };
        Insert: {
          amount: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          id?: string;
          period_month: string;
          provider: string;
          source?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          id?: string;
          period_month?: string;
          provider?: string;
          source?: string;
        };
        Relationships: [];
      };
      operation_reservations: {
        Row: {
          created_at: string;
          feature: string;
          id: string;
          reserved_usd: number;
          settled: boolean;
          settled_usd: number | null;
          units: number;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          feature: string;
          id?: string;
          reserved_usd: number;
          settled?: boolean;
          settled_usd?: number | null;
          units?: number;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          feature?: string;
          id?: string;
          reserved_usd?: number;
          settled?: boolean;
          settled_usd?: number | null;
          units?: number;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      operation_usage: {
        Row: {
          created_at: string;
          feature: string;
          id: string;
          units: number;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          feature: string;
          id?: string;
          units?: number;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          feature?: string;
          id?: string;
          units?: number;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      passport_shares: {
        Row: {
          created_at: string;
          expires_at: string;
          html: string;
          id: string;
          item_id: string | null;
          revoked: boolean;
          title: string;
          token: string;
          user_id: string;
          views: number;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          html: string;
          id?: string;
          item_id?: string | null;
          revoked?: boolean;
          title: string;
          token?: string;
          user_id?: string;
          views?: number;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          html?: string;
          id?: string;
          item_id?: string | null;
          revoked?: boolean;
          title?: string;
          token?: string;
          user_id?: string;
          views?: number;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      plan_defaults: {
        Row: {
          entitlements: Json;
          plan_key: string;
        };
        Insert: {
          entitlements: Json;
          plan_key: string;
        };
        Update: {
          entitlements?: Json;
          plan_key?: string;
        };
        Relationships: [];
      };
      plan_status: {
        Row: {
          active: boolean;
          plan_key: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          plan_key: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          plan_key?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      plan_versions: {
        Row: {
          audience: string;
          benefits: string[];
          capacity: Json;
          created_at: string;
          created_by: string | null;
          entitlements: Json | null;
          id: string;
          monthly: number | null;
          name: string;
          notes: string | null;
          plan_key: string;
          status: string;
          version: number;
          yearly: number | null;
        };
        Insert: {
          audience: string;
          benefits?: string[];
          capacity?: Json;
          created_at?: string;
          created_by?: string | null;
          entitlements?: Json | null;
          id?: string;
          monthly?: number | null;
          name: string;
          notes?: string | null;
          plan_key: string;
          status?: string;
          version: number;
          yearly?: number | null;
        };
        Update: {
          audience?: string;
          benefits?: string[];
          capacity?: Json;
          created_at?: string;
          created_by?: string | null;
          entitlements?: Json | null;
          id?: string;
          monthly?: number | null;
          name?: string;
          notes?: string | null;
          plan_key?: string;
          status?: string;
          version?: number;
          yearly?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_type: string;
          avatar_url: string | null;
          bio: string | null;
          branches: number | null;
          business_type: string | null;
          country: string;
          created_at: string;
          currency: string;
          display_name: string | null;
          household: string | null;
          id: string;
          job_title: string | null;
          language: string;
          limit_overrides: Json;
          org_name: string | null;
          org_size: string | null;
          phone: string | null;
          plan: string;
          plan_source: string | null;
          sector: string | null;
          suspended: boolean;
          timezone: string;
          trial_ends_at: string | null;
          updated_at: string;
          voucher_ends_at: string | null;
        };
        Insert: {
          account_type?: string;
          avatar_url?: string | null;
          bio?: string | null;
          branches?: number | null;
          business_type?: string | null;
          country?: string;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          household?: string | null;
          id: string;
          job_title?: string | null;
          language?: string;
          limit_overrides?: Json;
          org_name?: string | null;
          org_size?: string | null;
          phone?: string | null;
          plan?: string;
          plan_source?: string | null;
          sector?: string | null;
          suspended?: boolean;
          timezone?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
          voucher_ends_at?: string | null;
        };
        Update: {
          account_type?: string;
          avatar_url?: string | null;
          bio?: string | null;
          branches?: number | null;
          business_type?: string | null;
          country?: string;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          household?: string | null;
          id?: string;
          job_title?: string | null;
          language?: string;
          limit_overrides?: Json;
          org_name?: string | null;
          org_size?: string | null;
          phone?: string | null;
          plan?: string;
          plan_source?: string | null;
          sector?: string | null;
          suspended?: boolean;
          timezone?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
          voucher_ends_at?: string | null;
        };
        Relationships: [];
      };
      provider_connections: {
        Row: {
          last_checked_at: string | null;
          last_result: string | null;
          notes: string | null;
          provider: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          last_checked_at?: string | null;
          last_result?: string | null;
          notes?: string | null;
          provider: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          last_checked_at?: string | null;
          last_result?: string | null;
          notes?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      record_links: {
        Row: {
          confidence: number | null;
          confirmed: boolean;
          created_at: string;
          id: string;
          relationship_type: string;
          source_capture_type: string | null;
          source_document_id: string | null;
          source_extraction_id: string | null;
          source_item_id: string;
          target_item_id: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          confidence?: number | null;
          confirmed?: boolean;
          created_at?: string;
          id?: string;
          relationship_type: string;
          source_capture_type?: string | null;
          source_document_id?: string | null;
          source_extraction_id?: string | null;
          source_item_id: string;
          target_item_id: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Update: {
          confidence?: number | null;
          confirmed?: boolean;
          created_at?: string;
          id?: string;
          relationship_type?: string;
          source_capture_type?: string | null;
          source_document_id?: string | null;
          source_extraction_id?: string | null;
          source_item_id?: string;
          target_item_id?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "record_links_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "home_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "record_links_source_item_id_fkey";
            columns: ["source_item_id"];
            isOneToOne: false;
            referencedRelation: "home_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "record_links_target_item_id_fkey";
            columns: ["target_item_id"];
            isOneToOne: false;
            referencedRelation: "home_items";
            referencedColumns: ["id"];
          },
        ];
      };
      release_qa_checks: {
        Row: {
          check_name: string;
          outcome: string;
          run_id: string;
        };
        Insert: {
          check_name: string;
          outcome: string;
          run_id: string;
        };
        Update: {
          check_name?: string;
          outcome?: string;
          run_id?: string;
        };
        Relationships: [];
      };
      runtime_limits: {
        Row: {
          ai_enabled: boolean;
          billing_environment: string;
          daily_ai_budget_usd: number;
          requests_per_minute: number;
          singleton: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          ai_enabled?: boolean;
          billing_environment?: string;
          daily_ai_budget_usd?: number;
          requests_per_minute?: number;
          singleton?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ai_enabled?: boolean;
          billing_environment?: string;
          daily_ai_budget_usd?: number;
          requests_per_minute?: number;
          singleton?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_interval: string | null;
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          environment: string;
          id: string;
          plan_key: string | null;
          price_id: string;
          product_id: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          trial_end: string | null;
          trial_start: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          billing_interval?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          plan_key?: string | null;
          price_id: string;
          product_id: string;
          status?: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          billing_interval?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          plan_key?: string | null;
          price_id?: string;
          product_id?: string;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      trial_history: {
        Row: {
          ended_at: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          ended_at: string;
          started_at: string;
          user_id: string;
        };
        Update: {
          ended_at?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      voucher_redemptions: {
        Row: {
          outcome: string;
          checkout_session: string | null;
          subscription_id: string | null;
          coupon_id: string | null;
          billing_interval: string | null;
          billing_environment: string | null;
          checkout_plan: string | null;
          benefit_ends_at: string | null;
          benefit_type: string;
          benefit_value: number | null;
          code: string;
          created_at: string;
          id: string;
          plan_after: string | null;
          plan_before: string | null;
          user_id: string;
        };
        Insert: {
          benefit_ends_at?: string | null;
          benefit_type: string;
          benefit_value?: number | null;
          code: string;
          created_at?: string;
          id?: string;
          plan_after?: string | null;
          plan_before?: string | null;
          user_id: string;
        };
        Update: {
          benefit_ends_at?: string | null;
          benefit_type?: string;
          benefit_value?: number | null;
          code?: string;
          created_at?: string;
          id?: string;
          plan_after?: string | null;
          plan_before?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      vouchers: {
        Row: {
          active: boolean;
          assigned_email: string | null;
          audiences: string[];
          batch: string | null;
          benefit_ends_on: string | null;
          benefit_type: string;
          benefit_value: number | null;
          code: string;
          code_type: string;
          created_at: string;
          created_by: string | null;
          description: string;
          duration_months: number | null;
          max_uses: number;
          name: string;
          one_per_user: boolean;
          plan: string;
          uses: number;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          active?: boolean;
          assigned_email?: string | null;
          audiences?: string[];
          batch?: string | null;
          benefit_ends_on?: string | null;
          benefit_type?: string;
          benefit_value?: number | null;
          code: string;
          code_type?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          duration_months?: number | null;
          max_uses?: number;
          name?: string;
          one_per_user?: boolean;
          plan: string;
          uses?: number;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          active?: boolean;
          assigned_email?: string | null;
          audiences?: string[];
          batch?: string | null;
          benefit_ends_on?: string | null;
          benefit_type?: string;
          benefit_value?: number | null;
          code?: string;
          code_type?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          duration_months?: number | null;
          max_uses?: number;
          name?: string;
          one_per_user?: boolean;
          plan?: string;
          uses?: number;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id?: string;
          type?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      account_entitlements: { Args: { _user: string }; Returns: Json };
      ai_cost_summary:
        | { Args: { _from: string; _to: string }; Returns: Json }
        | {
            Args: { _since?: string };
            Returns: {
              cache_read: number;
              cache_savings: number;
              cache_write: number;
              calls: number;
              cost: number;
              hits: number;
              luna: number;
              measured_input: number;
              operations: number;
              reserved: number;
              savings: number;
              sol: number;
              speech_minutes: number;
              unpriced: number;
              users: number;
            }[];
          };
      apply_billing_event:
        | {
            Args: {
              _created: number;
              _environment: string;
              _event: string;
              _paid: boolean;
              _plan: string;
              _subscription: Json;
            };
            Returns: boolean;
          }
        | {
            Args: {
              _created: number;
              _environment: string;
              _event: string;
              _paid: boolean;
              _plan: string;
              _subscription: Json;
            };
            Returns: boolean;
          };
      approve_catalogue_version: {
        Args: { _admin: string; _id: string };
        Returns: undefined;
      };
      can_access_workspace: { Args: { _workspace: string }; Returns: boolean };
      can_share_passport: { Args: never; Returns: boolean };
      claim_ai_request:
        | {
            Args: {
              _feature: string;
              _key: string;
              _lease: string;
              _user: string;
              _workspace: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              _estimate: number;
              _feature: string;
              _hash: string;
              _user: string;
              _workspace: string;
            };
            Returns: Json;
          };
      claim_billing_action: { Args: { _key: string }; Returns: string };
      confirm_sera_review: { Args: { _draft: Json }; Returns: Json };
      feature_enabled: {
        Args: { _key: string; _user: string };
        Returns: boolean;
      };
      finish_ai_request:
        | {
            Args: { _key: string; _lease: string; _result: Json };
            Returns: undefined;
          }
        | { Args: { _reservation: string; _result: Json }; Returns: undefined };
      finish_metered_request:
        | {
            Args: {
              _key: string;
              _lease: string;
              _reservation: string;
              _result: Json;
            };
            Returns: undefined;
          }
        | { Args: { _reservation: string; _result: Json }; Returns: undefined };
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      open_passport_share: {
        Args: { _token: string };
        Returns: {
          expires_at: string;
          html: string;
          title: string;
        }[];
      };
      passport_records: {
        Args: { _subject: string };
        Returns: {
          created_at: string;
          fields: Json;
          id: string;
          property_id: string | null;
          section: string;
          subtitle: string;
          title: string;
          user_id: string;
          workspace_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "home_items";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      my_ai_allowances: {
        Args: never;
        Returns: {
          feature: string;
          enabled: boolean;
          monthly_limit: number | null;
          used: number;
          resets_at: string;
        }[];
      };
      effective_plan_catalogue: {
        Args: never;
        Returns: {
          audience: string;
          entitlements: Json;
          benefits: string[];
          capacity: Json;
          monthly: number | null;
          name: string;
          plan_key: string;
          yearly: number | null;
        }[];
      };
      published_plan_catalogue: {
        Args: never;
        Returns: {
          audience: string;
          benefits: string[];
          capacity: Json;
          monthly: number;
          name: string;
          plan_key: string;
          yearly: number;
        }[];
      };
      published_plan_entitlements: {
        Args: never;
        Returns: {
          entitlements: Json;
          plan_key: string;
        }[];
      };
      purge_expired_connector_data: { Args: never; Returns: undefined };
      reconcile_ai_budget: {
        Args: { _since?: string };
        Returns: {
          audio_seconds: number;
          costed_usd: number;
          input_tokens: number;
          model: string;
          output_tokens: number;
          unpriced_rows: number;
          usage_rows: number;
        }[];
      };
      record_email_reminder: {
        Args: { _enabled?: boolean; _record: string };
        Returns: boolean;
      };
      remove_checkout_voucher: { Args: { _plan: string }; Returns: undefined };
      my_checkout_vouchers: { Args: Record<PropertyKey, never>; Returns: Json };
      reserve_checkout_voucher: {
        Args: { _user: string; _plan: string; _interval: string; _environment: string };
        Returns: Json;
      };
      settle_checkout_voucher: {
        Args: {
          _hold: string;
          _environment: string;
          _user: string;
          _session: string | null;
          _subscription: string | null;
          _coupon: string | null;
          _state: string;
        };
        Returns: undefined;
      };
      redeem_voucher: { Args: { _code: string }; Returns: string };
      release_billing_action: {
        Args: { _key: string; _token: string };
        Returns: undefined;
      };
      release_sera_review: { Args: never; Returns: undefined };
      reserve_ai_operation:
        | {
            Args: {
              _estimate: number;
              _feature: string;
              _user: string;
              _workspace: string;
            };
            Returns: string;
          }
        | {
            Args: {
              _estimate: number;
              _feature: string;
              _units: number;
              _user: string;
              _workspace: string;
            };
            Returns: string;
          };
      reserve_ai_retry: {
        Args: { _estimate: number; _id: string; _user: string };
        Returns: undefined;
      };
      reserve_operation: {
        Args: {
          _feature: string;
          _units?: number;
          _user: string;
          _workspace: string;
        };
        Returns: string;
      };
      reserve_speech_minutes: {
        Args: { _minutes: number; _user: string; _workspace: string };
        Returns: string;
      };
      sera_keywords: {
        Args: {
          _fields: Json;
          _section: string;
          _subtitle: string;
          _title: string;
        };
        Returns: unknown;
      };
      sera_retrieve: {
        Args: { _intent: Json; _property: string; _workspace: string };
        Returns: Json;
      };
      settle_ai_operation:
        | {
            Args: { _calls: number; _id: string; _user: string };
            Returns: undefined;
          }
        | {
            Args: {
              _audio?: number;
              _cost: number;
              _feature: string;
              _id: string;
              _input: number;
              _model: string;
              _output: number;
              _user: string;
            };
            Returns: undefined;
          };
      start_business_trial: { Args: never; Returns: string };
    };
    Enums: {
      app_role: "super_admin" | "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const;
