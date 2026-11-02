const { createClient } = require('@supabase/supabase-js');
const existing = require('./supabase');
// Clave exclusivamente del backend; nunca usar variables del frontend.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
module.exports = key ? createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : existing;
