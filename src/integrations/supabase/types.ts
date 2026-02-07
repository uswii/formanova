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
      batch_images: {
        Row: {
          batch_id: string
          classification_category: string | null
          classification_flagged: boolean | null
          classification_is_worn: boolean | null
          created_at: string
          error_message: string | null
          id: string
          inspiration_url: string | null
          mask_url: string | null
          original_url: string
          processing_completed_at: string | null
          processing_started_at: string | null
          result_url: string | null
          sequence_number: number
          skin_tone: Database["public"]["Enums"]["skin_tone_type"] | null
          status: Database["public"]["Enums"]["batch_status"]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          classification_category?: string | null
          classification_flagged?: boolean | null
          classification_is_worn?: boolean | null
          created_at?: string
          error_message?: string | null
          id?: string
          inspiration_url?: string | null
          mask_url?: string | null
          original_url: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          result_url?: string | null
          sequence_number: number
          skin_tone?: Database["public"]["Enums"]["skin_tone_type"] | null
          status?: Database["public"]["Enums"]["batch_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          classification_category?: string | null
          classification_flagged?: boolean | null
          classification_is_worn?: boolean | null
          created_at?: string
          error_message?: string | null
          id?: string
          inspiration_url?: string | null
          mask_url?: string | null
          original_url?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          result_url?: string | null
          sequence_number?: number
          skin_tone?: Database["public"]["Enums"]["skin_tone_type"] | null
          status?: Database["public"]["Enums"]["batch_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_jobs: {
        Row: {
          completed_at: string | null
          completed_images: number
          created_at: string
          drive_link: string | null
          error_message: string | null
          failed_images: number
          id: string
          inspiration_url: string | null
          jewelry_category: Database["public"]["Enums"]["jewelry_category_type"]
          notification_email: string | null
          status: Database["public"]["Enums"]["batch_status"]
          total_images: number
          updated_at: string
          user_display_name: string | null
          user_email: string
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_images?: number
          created_at?: string
          drive_link?: string | null
          error_message?: string | null
          failed_images?: number
          id?: string
          inspiration_url?: string | null
          jewelry_category: Database["public"]["Enums"]["jewelry_category_type"]
          notification_email?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          total_images?: number
          updated_at?: string
          user_display_name?: string | null
          user_email: string
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_images?: number
          created_at?: string
          drive_link?: string | null
          error_message?: string | null
          failed_images?: number
          id?: string
          inspiration_url?: string | null
          jewelry_category?: Database["public"]["Enums"]["jewelry_category_type"]
          notification_email?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          total_images?: number
          updated_at?: string
          user_display_name?: string | null
          user_email?: string
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      batch_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "partial"
        | "delivered"
      jewelry_category_type:
        | "necklace"
        | "earring"
        | "ring"
        | "bracelet"
        | "watch"
      skin_tone_type: "fair" | "light" | "medium" | "tan" | "dark" | "deep"
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
      batch_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "partial",
        "delivered",
      ],
      jewelry_category_type: [
        "necklace",
        "earring",
        "ring",
        "bracelet",
        "watch",
      ],
      skin_tone_type: ["fair", "light", "medium", "tan", "dark", "deep"],
    },
  },
} as const
