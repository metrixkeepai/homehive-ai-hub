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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          reason: string | null
          target: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target?: string | null
        }
        Relationships: []
      }
      ai_model_rates: {
        Row: {
          input_per_million_usd: number
          model: string
          output_per_million_usd: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          input_per_million_usd?: number
          model: string
          output_per_million_usd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          input_per_million_usd?: number
          model?: string
          output_per_million_usd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cost_usd: number
          created_at: string
          error: string | null
          feature: string
          id: string
          input_tokens: number
          latency_ms: number | null
          model: string
          ok: boolean
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          model: string
          ok?: boolean
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          model?: string
          ok?: boolean
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          created_at: string
          id: string
          item_id: string
          mime: string
          name: string
          path: string
          size: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          mime?: string
          name: string
          path: string
          size?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          mime?: string
          name?: string
          path?: string
          size?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "home_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          audiences: string[]
          created_at: string
          description: string
          enabled: boolean
          key: string
          name: string
          rollout: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audiences?: string[]
          created_at?: string
          description?: string
          enabled?: boolean
          key: string
          name: string
          rollout?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audiences?: string[]
          created_at?: string
          description?: string
          enabled?: boolean
          key?: string
          name?: string
          rollout?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      health_checks: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          latency_ms: number | null
          ok: boolean
          service: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          latency_ms?: number | null
          ok: boolean
          service: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          service?: string
        }
        Relationships: []
      }
      home_items: {
        Row: {
          created_at: string
          fields: Json
          id: string
          section: string
          subtitle: string
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          section: string
          subtitle?: string
          title: string
          user_id?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          section?: string
          subtitle?: string
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      infra_costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          id: string
          period_month: string
          provider: string
          source: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          id?: string
          period_month: string
          provider: string
          source?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          id?: string
          period_month?: string
          provider?: string
          source?: string
        }
        Relationships: []
      }
      plan_versions: {
        Row: {
          audience: string
          benefits: string[]
          capacity: Json
          created_at: string
          created_by: string | null
          id: string
          monthly: number | null
          name: string
          notes: string | null
          plan_key: string
          status: string
          version: number
          yearly: number | null
        }
        Insert: {
          audience: string
          benefits?: string[]
          capacity?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          monthly?: number | null
          name: string
          notes?: string | null
          plan_key: string
          status?: string
          version: number
          yearly?: number | null
        }
        Update: {
          audience?: string
          benefits?: string[]
          capacity?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          monthly?: number | null
          name?: string
          notes?: string | null
          plan_key?: string
          status?: string
          version?: number
          yearly?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          branches: number | null
          business_type: string | null
          created_at: string
          currency: string
          display_name: string | null
          household: string | null
          id: string
          job_title: string | null
          language: string
          org_name: string | null
          org_size: string | null
          phone: string | null
          plan: string
          plan_source: string | null
          sector: string | null
          suspended: boolean
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          branches?: number | null
          business_type?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          household?: string | null
          id: string
          job_title?: string | null
          language?: string
          org_name?: string | null
          org_size?: string | null
          phone?: string | null
          plan?: string
          plan_source?: string | null
          sector?: string | null
          suspended?: boolean
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          branches?: number | null
          business_type?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          household?: string | null
          id?: string
          job_title?: string | null
          language?: string
          org_name?: string | null
          org_size?: string | null
          phone?: string | null
          plan?: string
          plan_source?: string | null
          sector?: string | null
          suspended?: boolean
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_connections: {
        Row: {
          last_checked_at: string | null
          last_result: string | null
          notes: string | null
          provider: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          last_checked_at?: string | null
          last_result?: string | null
          notes?: string | null
          provider: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          last_checked_at?: string | null
          last_result?: string | null
          notes?: string | null
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          max_uses: number
          plan: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          max_uses?: number
          plan: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          max_uses?: number
          plan?: string
          uses?: number
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_voucher: { Args: { _code: string }; Returns: string }
      start_business_trial: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
