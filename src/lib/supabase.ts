import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
const webStorage = {
  getItem: async (key: string) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); },
  removeItem: async (key: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(key); },
};

export const supabase = createClient(supabaseUrl ?? 'https://missing-project.supabase.co', supabasePublishableKey ?? 'missing-publishable-key', {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          age: number | null;
          bio: string | null;
          avatar_color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      interests: {
        Row: { id: string; name: string; kind: 'interest' | 'activity'; created_at: string };
        Insert: Omit<Database['public']['Tables']['interests']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['interests']['Insert']>;
      };
      profile_interests: {
        Row: { profile_id: string; interest_id: string };
        Insert: Database['public']['Tables']['profile_interests']['Row'];
        Update: Partial<Database['public']['Tables']['profile_interests']['Insert']>;
      };
      availability: {
        Row: { profile_id: string; is_available: boolean; available_date: string; updated_at: string };
        Insert: Omit<Database['public']['Tables']['availability']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['availability']['Insert']>;
      };
      plans: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          starts_at: string;
          activity: string;
          status: 'upcoming' | 'invited' | 'past' | 'joined' | 'cancelled';
          location_name: string;
          location_area: string | null;
          location_vibe: string | null;
          location_note: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
      };
      plan_members: {
        Row: { plan_id: string; profile_id: string; status: 'invited' | 'joined' | 'declined'; created_at: string };
        Insert: Omit<Database['public']['Tables']['plan_members']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['plan_members']['Insert']>;
      };
      conversations: {
        Row: { id: string; created_by: string; plan_id: string | null; created_at: string };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      conversation_members: {
        Row: { conversation_id: string; profile_id: string; joined_at: string };
        Insert: Omit<Database['public']['Tables']['conversation_members']['Row'], 'joined_at'>;
        Update: Partial<Database['public']['Tables']['conversation_members']['Insert']>;
      };
      messages: {
        Row: { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      connections: {
        Row: { requester_id: string; addressee_id: string; status: 'pending' | 'accepted' | 'declined'; created_at: string; updated_at: string };
        Insert: Omit<Database['public']['Tables']['connections']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['connections']['Insert']>;
      };
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: Omit<Database['public']['Tables']['blocks']['Row'], 'created_at'>;
        Update: never;
      };
      reports: {
        Row: { id: string; reporter_id: string; reported_profile_id: string; reason: string; details: string | null; status: 'open' | 'reviewed' | 'closed'; created_at: string };
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'status' | 'created_at'>;
        Update: never;
      };
    };
  };
};