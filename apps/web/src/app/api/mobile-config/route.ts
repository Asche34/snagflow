import { connection } from 'next/server';
import { mobileConfigHeaders, mobileConfigResponse } from '@/lib/mobile-config';
export async function GET() {
  await connection();
  return mobileConfigResponse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    MOBILE_PUBLIC_SUPABASE_URL: process.env.MOBILE_PUBLIC_SUPABASE_URL,
  });
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: mobileConfigHeaders });
}
