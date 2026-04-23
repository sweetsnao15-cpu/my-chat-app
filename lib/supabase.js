import { createClient } from '@supabase/supabase-js'

// .env.localを使わずに、直接ここに書きます
const supabaseUrl = 'https://yopgxddrdmakirwzunxb.supabase.co'
const supabaseAnonKey = 'sb_publishable_iWs_uFnCnMaR85If4wwVIA_gyo_Svms'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)