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
      profiles: {
        Row: {
          avatar_url: string | null
          child_age: number | null
          child_name: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          child_age?: number | null
          child_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          child_age?: number | null
          child_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_contexts: {
        Row: {
          characters: string[] | null
          child_age: number | null
          child_name: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          interests: string[] | null
          moral_lesson: string | null
          raw_chat: Json | null
          setting: string | null
          theme: string | null
          tone: string | null
          user_id: string
        }
        Insert: {
          characters?: string[] | null
          child_age?: number | null
          child_name?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          interests?: string[] | null
          moral_lesson?: string | null
          raw_chat?: Json | null
          setting?: string | null
          theme?: string | null
          tone?: string | null
          user_id: string
        }
        Update: {
          characters?: string[] | null
          child_age?: number | null
          child_name?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          interests?: string[] | null
          moral_lesson?: string | null
          raw_chat?: Json | null
          setting?: string | null
          theme?: string | null
          tone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_library: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean | null
          last_played_at: string | null
          play_count: number | null
          script_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          last_played_at?: string | null
          play_count?: number | null
          script_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          last_played_at?: string | null
          play_count?: number | null
          script_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_library_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "story_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      story_scenes: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          image_url: string | null
          narration_text: string
          scene_number: number
          script_id: string
          visual_prompt: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          narration_text: string
          scene_number: number
          script_id: string
          visual_prompt?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          narration_text?: string
          scene_number?: number
          script_id?: string
          visual_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_scenes_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "story_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      story_scripts: {
        Row: {
          context_id: string
          created_at: string
          id: string
          scene_count: number
          status: string
          synopsis: string | null
          title: string
          updated_at: string
          user_id: string
          voice_id: string | null
        }
        Insert: {
          context_id: string
          created_at?: string
          id?: string
          scene_count?: number
          status?: string
          synopsis?: string | null
          title: string
          updated_at?: string
          user_id: string
          voice_id?: string | null
        }
        Update: {
          context_id?: string
          created_at?: string
          id?: string
          scene_count?: number
          status?: string
          synopsis?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_scripts_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "story_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
