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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          customer_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          plan_id: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          plan_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          plan_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          status: string
          price_id: string
          quantity: number
          cancel_at_period_end: boolean
          cancel_at: string | null
          canceled_at: string | null
          current_period_start: string
          current_period_end: string
          created: string
          ended_at: string | null
          trial_start: string | null
          trial_end: string | null
        }
        Insert: {
          id: string
          user_id: string
          customer_id: string
          status: string
          price_id: string
          quantity?: number
          cancel_at_period_end?: boolean
          cancel_at?: string | null
          canceled_at?: string | null
          current_period_start: string
          current_period_end: string
          created: string
          ended_at?: string | null
          trial_start?: string | null
          trial_end?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          status?: string
          price_id?: string
          quantity?: number
          cancel_at_period_end?: boolean
          cancel_at?: string | null
          canceled_at?: string | null
          current_period_start?: string
          current_period_end?: string
          created?: string
          ended_at?: string | null
          trial_start?: string | null
          trial_end?: string | null
        }
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
  }
}