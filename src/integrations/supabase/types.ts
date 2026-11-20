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
      ai_model_rates: {
        Row: {
          input_per_million_usd: number;
          model: string;
          output_per_million_usd: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          input_per_million_usd?: number;
          model: string;
          output_per_million_usd?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          input_per_million_usd?: number;
          model?: string;
          output_per_million_usd?: number;
          updated_at?: string;
          updated_by?: string | null;
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
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [];
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          environment: string;
          id: string;
          price_id: string;
          product_id: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          price_id: string;
          product_id: string;
          status?: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          price_id?: string;
          product_id?: string;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          updated_at?: string | null;
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
      apply_billing_event: {
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
      feature_enabled: {
        Args: { _key: string; _user: string };
        Returns: boolean;
      };
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
      passport_records: {
        Args: { _subject: string };
        Returns: Database["public"]["Tables"]["home_items"]["Row"][];
      };
      open_passport_share: {
        Args: { _token: string };
        Returns: {
          expires_at: string;
          html: string;
          title: string;
        }[];
      };
      published_plan_entitlements: {
        Args: never;
        Returns: {
          entitlements: Json;
          plan_key: string;
        }[];
      };
      redeem_voucher: { Args: { _code: string }; Returns: string };
      reserve_operation: {
        Args: {
          _feature: string;
          _units?: number;
          _user: string;
          _workspace: string;
        };
        Returns: string;
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
