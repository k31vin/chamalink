// Type definitions for Deno runtime in Supabase Edge Functions

declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

export {};
