// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aiqmqmhqbhufcybrccxt.supabase.co'
const supabaseKey = 'sb_publishable_5cZ3lawYY78b533kXeQW1w_NqM9lIhn'

export const supabase = createClient(supabaseUrl, supabaseKey)
