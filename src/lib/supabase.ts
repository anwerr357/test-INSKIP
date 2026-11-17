import { createClient } from '@supabase/supabase-js'

// L'URL et la clé publique ne sont pas des secrets : elles sont visibles dans le navigateur
// de toute façon. Ce qui protège les données, ce sont les règles RLS de la base
// (voir supabase/migrations).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null
