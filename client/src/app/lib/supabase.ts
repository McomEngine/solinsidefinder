// src/app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Ortam değişkenlerini al
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Hata kontrolü
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.'
  );
}

// Supabase istemcisini oluştur
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function checkAllowlist(walletAddress: string): Promise<boolean> {
  const { data } = await supabase
    .from('allowlist')
    .select('wallet_address')
    .eq('wallet_address', walletAddress);
  return !!data?.length;
}