export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      community_active_users: {
        Row: {
          user_id: string
          username: string
          region: string
          last_seen_at: string
        }
        Insert: {
          user_id: string
          username: string
          region: string
          last_seen_at?: string
        }
        Update: {
          user_id?: string
          username?: string
          region?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      community_chat_sessions: {
        Row: {
          id: string
          name: string
          area: string
          region: string
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          area: string
          region: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          area?: string
          region?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          id: string
          parent_id: string | null
          author: string
          text: string
          region: string
          likes: number
          created_at: string
        }
        Insert: {
          id?: string
          parent_id?: string | null
          author: string
          text: string
          region: string
          likes?: number
          created_at?: string
        }
        Update: {
          id?: string
          parent_id?: string | null
          author?: string
          text?: string
          region?: string
          likes?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          id: string
          name: string
          area: string
          region: string
          category: string
          message: string
          image: string | null
          coords: Json | null
          anonymous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          area: string
          region: string
          category: string
          message: string
          image?: string | null
          coords?: Json | null
          anonymous?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          area?: string
          region?: string
          category?: string
          message?: string
          image?: string | null
          coords?: Json | null
          anonymous?: boolean
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string
          email: string
          full_name: string | null
          permanent_location: Json
          current_location: Json | null
          profile_picture: string | null
          role: 'super_admin' | 'regional_admin' | 'community_moderator' | 'verified_reporter' | 'user'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          email: string
          full_name?: string | null
          permanent_location: Json
          current_location?: Json | null
          profile_picture?: string | null
          role?: 'super_admin' | 'regional_admin' | 'community_moderator' | 'verified_reporter' | 'user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          email?: string
          full_name?: string | null
          permanent_location?: Json
          current_location?: Json | null
          profile_picture?: string | null
          role?: 'super_admin' | 'regional_admin' | 'community_moderator' | 'verified_reporter' | 'user'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
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
