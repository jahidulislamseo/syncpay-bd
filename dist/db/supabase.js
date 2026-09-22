import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
let supabaseClient = null;
export function getSupabaseClient() {
    if (supabaseClient) {
        return supabaseClient;
    }
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        return supabaseClient;
    }
    return null;
}
export function isSupabaseConfigured() {
    return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
