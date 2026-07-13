export interface SupabaseServerEnvironment { url: string; secretKey: string }

export function readSupabaseServerEnvironment(environment = process.env.NODE_ENV ?? 'development'): SupabaseServerEnvironment | null {
  if (environment === 'test' || (environment !== 'production' && process.env.ACCOUNT_TEST_MODE === 'true')) return null;
  const url = process.env.SUPABASE_URL?.trim(); const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (url && secretKey) return { url, secretKey };
  throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
}
