require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.warn('[!] SUPABASE_URL / SUPABASE_SERVICE_KEY manquants : voir .env.example');
}
const db = createClient(process.env.SUPABASE_URL || 'http://localhost', process.env.SUPABASE_SERVICE_KEY || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false }
});
module.exports = db;
