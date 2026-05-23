// ============================================================
//  EZielts — Supabase Database Types
//  Auto-generate with: npx supabase gen types typescript
//  This file is the manual version until CLI is set up.
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Plan = "free" | "pro_monthly" | "pro_quarterly" | "pro_annual";
export type SubStatus = "active" | "cancelled" | "expired" | "trialing";
export type ContentType = "reading" | "listening" | "writing" | "speaking";
export type ExamType = "academic" | "general" | "unknown";
export type QuestionType = "mcq" | "tfng" | "matching" | "completion" | "short_answer";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          target_band: number | null;
          exam_type: ExamType | null;
          goal: string | null;
          exam_date: string | null;
          current_band: number | null;
          band_reading: number | null;
          band_listening: number | null;
          band_writing: number | null;
          band_speaking: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: Plan;
          status: SubStatus;
          freedompay_sub_id: string | null;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      user_daily_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          reading_count: number;
          listening_count: number;
          writing_count: number;
          speaking_count: number;
          ai_tutor_total: number;
        };
        Insert: Omit<Database["public"]["Tables"]["user_daily_usage"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["user_daily_usage"]["Insert"]>;
      };
      reading_tests: {
        Row: {
          id: string;
          source: string;
          category: string;
          title: string;
          difficulty: string | null;
          external_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reading_tests"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reading_tests"]["Insert"]>;
      };
      reading_sections: {
        Row: {
          id: string;
          test_id: string;
          part_number: number;
          passage_text: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reading_sections"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reading_sections"]["Insert"]>;
      };
      reading_question_groups: {
        Row: {
          id: string;
          section_id: string;
          instruction: string | null;
          question_type: QuestionType;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["reading_question_groups"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["reading_question_groups"]["Insert"]>;
      };
      reading_questions: {
        Row: {
          id: string;
          group_id: string;
          question_text: string;
          options: Json | null;
          correct_answer: string;
          explanation: string | null;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["reading_questions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["reading_questions"]["Insert"]>;
      };
      listening_tests: {
        Row: {
          id: string;
          source: string;
          title: string;
          section: number | null;
          audio_url: string | null;
          audio_duration: number | null;
          transcript: string | null;
          external_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["listening_tests"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["listening_tests"]["Insert"]>;
      };
      listening_question_groups: {
        Row: {
          id: string;
          test_id: string;
          instruction: string | null;
          question_type: QuestionType;
          section_number: number | null;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["listening_question_groups"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["listening_question_groups"]["Insert"]>;
      };
      listening_questions: {
        Row: {
          id: string;
          group_id: string;
          question_text: string;
          options: Json | null;
          correct_answer: string;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["listening_questions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["listening_questions"]["Insert"]>;
      };
      writing_tasks: {
        Row: {
          id: string;
          source: string;
          task_type: "task1" | "task2";
          exam_type: ExamType | null;
          prompt_text: string;
          image_url: string | null;
          sample_answer: string | null;
          min_words: number;
          external_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["writing_tasks"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["writing_tasks"]["Insert"]>;
      };
      speaking_topics: {
        Row: {
          id: string;
          source: string;
          part: 1 | 2 | 3;
          topic_text: string;
          cue_card_points: Json | null;
          follow_up_questions: Json | null;
          sample_answer: string | null;
          band_range: string | null;
          external_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["speaking_topics"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["speaking_topics"]["Insert"]>;
      };
      user_test_attempts: {
        Row: {
          id: string;
          user_id: string;
          content_type: ContentType;
          content_id: string;
          answers: Json | null;
          band_score: number | null;
          raw_score: number | null;
          total_questions: number | null;
          ai_feedback: Json | null;
          time_spent: number | null;
          completed_at: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_test_attempts"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["user_test_attempts"]["Insert"]>;
      };
      diagnostic_results: {
        Row: {
          id: string;
          user_id: string | null;
          session_token: string | null;
          band_reading: number | null;
          band_listening: number | null;
          band_grammar: number | null;
          overall_band: number | null;
          weak_skills: string[] | null;
          answers: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["diagnostic_results"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["diagnostic_results"]["Insert"]>;
      };
      ai_tutor_messages: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_tutor_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ai_tutor_messages"]["Insert"]>;
      };
    };
    Functions: {
      is_pro: {
        Args: { uid?: string };
        Returns: boolean;
      };
      check_daily_limit: {
        Args: { p_user_id: string; p_content_type: string };
        Returns: boolean;
      };
      increment_usage: {
        Args: { p_user_id: string; p_content_type: string };
        Returns: undefined;
      };
      get_next_reading: {
        Args: { p_user_id: string };
        Returns: string;
      };
      get_next_listening: {
        Args: { p_user_id: string };
        Returns: string;
      };
      get_next_writing: {
        Args: { p_user_id: string; p_task_type?: string };
        Returns: string;
      };
      update_profile_band: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    Views: {
      v_user_summary: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          target_band: number | null;
          current_band: number | null;
          band_reading: number | null;
          band_listening: number | null;
          band_writing: number | null;
          band_speaking: number | null;
          exam_date: string | null;
          exam_type: ExamType | null;
          plan: Plan;
          subscription_status: SubStatus;
          current_period_end: string | null;
          is_pro: boolean;
          streak: number;
        };
      };
      v_band_history: {
        Row: {
          user_id: string;
          content_type: ContentType;
          attempt_date: string;
          daily_band: number;
        };
      };
    };
  };
}
