/**
 * Database shape, mirroring `supabase/migrations/0001_init.sql`.
 *
 * Hand-maintained rather than generated so a clone without the Supabase CLI
 * still typechecks. If you change the schema, change both — the migration is
 * the source of truth, this file is the contract the client codes against.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
        };
        Relationships: [];
      };
      rolls: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          emoji: string | null;
          cover_style: string;
          mode: string;
          shot_limit: number | null;
          reveal_at: string | null;
          developed_at: string | null;
          share_code: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          owner_id: string;
          title: string;
          emoji?: string | null;
          cover_style?: string;
          mode?: string;
          shot_limit?: number | null;
          reveal_at?: string | null;
          developed_at?: string | null;
          share_code?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["rolls"]["Insert"]>;
        Relationships: [];
      };
      roll_members: {
        Row: {
          roll_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          roll_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: { role?: string };
        Relationships: [];
      };
      captures: {
        Row: {
          id: string;
          roll_id: string;
          author_id: string;
          storage_path: string;
          width: number;
          height: number;
          filter_id: string;
          profile_id: string;
          aspect: string;
          source: string;
          favorite: boolean;
          taken_at: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          roll_id: string;
          author_id: string;
          storage_path: string;
          width: number;
          height: number;
          filter_id: string;
          profile_id: string;
          aspect: string;
          source?: string;
          favorite?: boolean;
          taken_at: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["captures"]["Insert"]>;
        Relationships: [];
      };
      strips: {
        Row: {
          id: string;
          roll_id: string;
          author_id: string;
          template_id: string;
          storage_path: string;
          width: number;
          height: number;
          caption: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          roll_id: string;
          author_id: string;
          template_id: string;
          storage_path: string;
          width: number;
          height: number;
          caption?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["strips"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_roll_by_code: {
        Args: { code: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
