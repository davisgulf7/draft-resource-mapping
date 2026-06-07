/* ─────────────────────────────────────────────────────────────
   Shared Supabase configuration.
   Loaded by every page before any other app script.
───────────────────────────────────────────────────────────── */

window.SUPABASE_URL  = 'https://akujnbqovzlzvrpqdtfd.supabase.co';
window.SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdWpuYnFvdnpsenZycHFkdGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjIyNzgsImV4cCI6MjA5NDQzODI3OH0.dC36a722RNIwqSG3Dq9XcVxzNwtWH9ovnufZiYu4XBY';

/* Single shared client instance. Pages can also reference globalThis.sb. */
window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
