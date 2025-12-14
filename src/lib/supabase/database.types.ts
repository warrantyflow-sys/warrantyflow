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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      device_models: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          manufacturer: string | null
          model_name: string
          updated_at: string
          warranty_months: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          model_name: string
          updated_at?: string
          warranty_months?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          model_name?: string
          updated_at?: string
          warranty_months?: number
        }
        Relationships: []
      }
      device_search_log: {
        Row: {
          created_at: string
          device_found: boolean
          device_id: string | null
          id: string
          ip_address: unknown
          search_term: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_found: boolean
          device_id?: string | null
          id?: string
          ip_address?: unknown
          search_term: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_found?: boolean
          device_id?: string | null
          id?: string
          ip_address?: unknown
          search_term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_search_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_search_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_search_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          id: string
          imei: string
          imei2: string | null
          import_batch: string | null
          imported_by: string | null
          is_replaced: boolean
          model_id: string
          notes: string | null
          replaced_at: string | null
          updated_at: string
          warranty_months: number
        }
        Insert: {
          created_at?: string
          id?: string
          imei: string
          imei2?: string | null
          import_batch?: string | null
          imported_by?: string | null
          is_replaced?: boolean
          model_id: string
          notes?: string | null
          replaced_at?: string | null
          updated_at?: string
          warranty_months?: number
        }
        Update: {
          created_at?: string
          id?: string
          imei?: string
          imei2?: string | null
          import_batch?: string | null
          imported_by?: string | null
          is_replaced?: boolean
          model_id?: string
          notes?: string | null
          replaced_at?: string | null
          updated_at?: string
          warranty_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "devices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_repair_prices: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lab_id: string
          notes: string | null
          price: number
          repair_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          lab_id: string
          notes?: string | null
          price: number
          repair_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lab_id?: string
          notes?: string | null
          price?: number
          repair_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_repair_prices_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_repair_prices_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_opened: boolean
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_opened?: boolean
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_opened?: boolean
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          lab_id: string
          notes: string | null
          payment_date: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          lab_id: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          lab_id?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      repairs: {
        Row: {
          completed_at: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          custom_repair_description: string | null
          custom_repair_price: number | null
          customer_name: string
          customer_phone: string
          device_id: string
          fault_description: string | null
          fault_type: Database["public"]["Enums"]["fault_type"] | null
          id: string
          lab_id: string
          notes: string | null
          repair_type_id: string | null
          status: Database["public"]["Enums"]["repair_status"]
          updated_at: string
          warranty_id: string | null
        }
        Insert: {
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          custom_repair_description?: string | null
          custom_repair_price?: number | null
          customer_name: string
          customer_phone: string
          device_id: string
          fault_description?: string | null
          fault_type?: Database["public"]["Enums"]["fault_type"] | null
          id?: string
          lab_id: string
          notes?: string | null
          repair_type_id?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          updated_at?: string
          warranty_id?: string | null
        }
        Update: {
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          custom_repair_description?: string | null
          custom_repair_price?: number | null
          customer_name?: string
          customer_phone?: string
          device_id?: string
          fault_description?: string | null
          fault_type?: Database["public"]["Enums"]["fault_type"] | null
          id?: string
          lab_id?: string
          notes?: string | null
          repair_type_id?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          updated_at?: string
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repairs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          device_id: string
          id: string
          reason: string
          repair_id: string | null
          requester_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          warranty_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          device_id: string
          id?: string
          reason: string
          repair_id?: string | null
          requester_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          warranty_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          device_id?: string
          id?: string
          reason?: string
          repair_id?: string | null
          requester_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replacement_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          notification_preferences: Json | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          notification_preferences?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          notification_preferences?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      warranties: {
        Row: {
          activated_by: string | null
          activation_date: string
          created_at: string
          customer_name: string
          customer_phone: string
          device_id: string
          expiry_date: string
          id: string
          is_active: boolean
          notes: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          activated_by?: string | null
          activation_date?: string
          created_at?: string
          customer_name: string
          customer_phone: string
          device_id: string
          expiry_date: string
          id?: string
          is_active?: boolean
          notes?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_by?: string | null
          activation_date?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          device_id?: string
          expiry_date?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      devices_with_status: {
        Row: {
          created_at: string | null
          id: string | null
          imei: string | null
          imei2: string | null
          import_batch: string | null
          imported_by: string | null
          is_replaced: boolean | null
          model_id: string | null
          model_name: string | null
          notes: string | null
          replaced_at: string | null
          updated_at: string | null
          warranty_months: number | null
          warranty_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_warranty: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_device_id: string
          p_notes?: string
        }
        Returns: {
          expiry_date: string
          message: string
          success: boolean
          warranty_id: string
        }[]
      }
      approve_replacement: {
        Args: { p_admin_notes?: string; p_request_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      create_replacement_request: {
        Args: { p_device_id: string; p_reason: string; p_repair_id?: string }
        Returns: {
          message: string
          request_id: string
          success: boolean
        }[]
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_admin_devices_paginated: {
        Args: {
          p_model_filter?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status_filter?: string
        }
        Returns: Json
      }
      get_dashboard_counts: { Args: never; Returns: Json }
      get_lab_balance: { Args: never; Returns: number }
      get_lab_dashboard_stats: { Args: never; Returns: Json }
      get_lab_device_count: { Args: never; Returns: number }
      get_lab_financial_summary: {
        Args: never
        Returns: {
          balance: number
          lab_email: string
          lab_id: string
          lab_name: string
          payments_count: number
          repairs_count: number
          total_earned: number
          total_paid: number
        }[]
      }
      get_lab_monthly_stats: { Args: { p_lab_id?: string }; Returns: Json }
      get_lab_repairs_paginated: {
        Args: { p_lab_id: string; p_page?: number; p_page_size?: number }
        Returns: Json
      }
      get_my_role: { Args: never; Returns: string }
      get_periodic_repair_stats: {
        Args: {
          p_start_date: string
          p_end_date: string
        }
        Returns: Json
      }
      get_repair_stats: { Args: never; Returns: Json }
      get_repairs_paginated: {
        Args: {
          p_lab_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_replacement_stats: { Args: never; Returns: Json }
      get_store_device_count: { Args: never; Returns: number }
      get_user_notification_preference: {
        Args: { p_preference_key: string; p_user_id: string }
        Returns: boolean
      }
      get_warranty_stats: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_lab: { Args: never; Returns: boolean }
      is_store: { Args: never; Returns: boolean }
      lab_check_imei_exists: {
        Args: { p_imei: string }
        Returns: {
          device_exists: boolean
          device_id: string
          has_active_warranty: boolean
          message: string
          model_name: string
        }[]
      }
      mark_notification_as_opened: {
        Args: { notification_id: string }
        Returns: boolean
      }
      mark_notifications_as_read: {
        Args: { notification_ids: string[] }
        Returns: boolean
      }
      notify_admins: {
        Args: {
          p_data?: Json
          p_excluded_user_id?: string
          p_message: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      reject_replacement: {
        Args: { p_admin_notes: string; p_request_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      search_device: {
        Args: { search_term: string }
        Returns: {
          has_warranty: boolean
          id: string
          imei: string
          imei2: string
          model_name: string
        }[]
      }
      search_device_by_imei: {
        Args: { p_imei: string; p_user_ip?: string }
        Returns: {
          customer_name: string
          customer_phone: string
          device_found: boolean
          device_id: string
          has_active_warranty: boolean
          imei: string
          imei2: string
          is_own_warranty: boolean
          is_replaced: boolean
          manufacturer: string
          message: string
          model_id: string
          model_name: string
          replaced_at: string
          warranty_expiry_date: string
          warranty_id: string
          warranty_months: number
        }[]
      }
      search_repairs_by_imei: {
        Args: { p_imei: string; p_page?: number; p_page_size?: number }
        Returns: Json
      }
      store_check_imei_exists: {
        Args: { p_imei: string }
        Returns: {
          device_exists: boolean
          device_id: string
          is_mine: boolean
          message: string
        }[]
      }
    }
    Enums: {
      fault_type:
        | "screen"
        | "charging_port"
        | "flash"
        | "speaker"
        | "board"
        | "other"
      repair_status:
        | "received"
        | "in_progress"
        | "completed"
        | "replacement_requested"
        | "cancelled"
      request_status: "pending" | "approved" | "rejected"
      user_role: "admin" | "store" | "lab"
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
      fault_type: [
        "screen",
        "charging_port",
        "flash",
        "speaker",
        "board",
        "other",
      ],
      repair_status: [
        "received",
        "in_progress",
        "completed",
        "replacement_requested",
        "cancelled",
      ],
      request_status: ["pending", "approved", "rejected"],
      user_role: ["admin", "store", "lab"],
    },
  },
} as const
