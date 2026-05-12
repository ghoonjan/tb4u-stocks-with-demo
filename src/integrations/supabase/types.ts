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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          target_value: number | null
          ticker: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          target_value?: number | null
          ticker: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          target_value?: number | null
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefings: {
        Row: {
          briefing_date: string
          content: string
          created_at: string
          generation_count: number
          id: string
          user_id: string
        }
        Insert: {
          briefing_date?: string
          content: string
          created_at?: string
          generation_count?: number
          id?: string
          user_id: string
        }
        Update: {
          briefing_date?: string
          content?: string
          created_at?: string
          generation_count?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finnhub_cache: {
        Row: {
          cache_key: string
          cached_at: string
          endpoint: string
          id: string
          response_data: Json
          ttl_seconds: number
        }
        Insert: {
          cache_key: string
          cached_at?: string
          endpoint: string
          id?: string
          response_data: Json
          ttl_seconds?: number
        }
        Update: {
          cache_key?: string
          cached_at?: string
          endpoint?: string
          id?: string
          response_data?: Json
          ttl_seconds?: number
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_cost_basis: number
          company_name: string | null
          conviction_rating: number
          date_added: string
          id: string
          notes: string | null
          portfolio_id: string
          shares: number
          target_allocation_pct: number | null
          thesis: string | null
          ticker: string
        }
        Insert: {
          avg_cost_basis: number
          company_name?: string | null
          conviction_rating?: number
          date_added?: string
          id?: string
          notes?: string | null
          portfolio_id: string
          shares: number
          target_allocation_pct?: number | null
          thesis?: string | null
          ticker: string
        }
        Update: {
          avg_cost_basis?: number
          company_name?: string | null
          conviction_rating?: number
          date_added?: string
          id?: string
          notes?: string | null
          portfolio_id?: string
          shares?: number
          target_allocation_pct?: number | null
          thesis?: string | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          id: string
          is_template: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_template?: boolean
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_template?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          digest_frequency: string
          digest_preferred_time: string
          display_name: string | null
          email: string | null
          email_digest_enabled: boolean
          full_name: string | null
          has_been_initialized: boolean
          id: string
          onboarding_completed: boolean
        }
        Insert: {
          created_at?: string
          digest_frequency?: string
          digest_preferred_time?: string
          display_name?: string | null
          email?: string | null
          email_digest_enabled?: boolean
          full_name?: string | null
          has_been_initialized?: boolean
          id: string
          onboarding_completed?: boolean
        }
        Update: {
          created_at?: string
          digest_frequency?: string
          digest_preferred_time?: string
          display_name?: string | null
          email?: string | null
          email_digest_enabled?: boolean
          full_name?: string | null
          has_been_initialized?: boolean
          id?: string
          onboarding_completed?: boolean
        }
        Relationships: []
      }
      stock_lookup: {
        Row: {
          asset_type: string | null
          company_name: string
          id: string
          sector: string | null
          ticker: string
          updated_at: string | null
        }
        Insert: {
          asset_type?: string | null
          company_name: string
          id?: string
          sector?: string | null
          ticker: string
          updated_at?: string | null
        }
        Update: {
          asset_type?: string | null
          company_name?: string
          id?: string
          sector?: string | null
          ticker?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tax_lots: {
        Row: {
          cost_basis_per_share: number
          created_at: string
          holding_id: string
          id: string
          notes: string | null
          purchased_at: string
          shares: number
          shares_remaining: number
        }
        Insert: {
          cost_basis_per_share: number
          created_at?: string
          holding_id: string
          id?: string
          notes?: string | null
          purchased_at: string
          shares: number
          shares_remaining: number
        }
        Update: {
          cost_basis_per_share?: number
          created_at?: string
          holding_id?: string
          id?: string
          notes?: string | null
          purchased_at?: string
          shares?: number
          shares_remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_lots_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_journal: {
        Row: {
          action: string
          created_at: string
          exit_reason: string | null
          id: string
          price_at_action: number | null
          self_grade: string | null
          shares: number | null
          thesis_at_time: string | null
          ticker: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          exit_reason?: string | null
          id?: string
          price_at_action?: number | null
          self_grade?: string | null
          shares?: number | null
          thesis_at_time?: string | null
          ticker: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          exit_reason?: string | null
          id?: string
          price_at_action?: number | null
          self_grade?: string | null
          shares?: number | null
          thesis_at_time?: string | null
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_journal_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      watchlist: {
        Row: {
          company_name: string | null
          date_added: string
          id: string
          notes: string | null
          target_price: number | null
          ticker: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          date_added?: string
          id?: string
          notes?: string | null
          target_price?: number | null
          ticker: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          date_added?: string
          id?: string
          notes?: string | null
          target_price?: number | null
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_template: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          notes: string | null
          target_price: number | null
          ticker: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          target_price?: number | null
          ticker: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          target_price?: number | null
          ticker?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_seed_user_template: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cleanup_stale_finnhub_cache: { Args: never; Returns: undefined }
      clone_template_for_user: {
        Args: { new_user_id: string }
        Returns: undefined
      }
      clonetemplatefor_user: {
        Args: { new_user_id: string }
        Returns: undefined
      }
      delete_user_completely: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
