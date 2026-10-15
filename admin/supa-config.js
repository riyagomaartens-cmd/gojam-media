// Shared Supabase client for the admin app and the delivery builder.
// The anon key is safe in client code — row-level security protects the data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const SUPABASE_URL = "https://qkpnmoepnsmdkqgbfozz.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcG5tb2VwbnNtZGtxZ2Jmb3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTkwMzgsImV4cCI6MjEwNzU3NTAzOH0.HPHpzocgvcplluMMafy9V3Zv0PSPkaGtrR1-rVjCgxg";
export const supa = createClient(SUPABASE_URL, SUPABASE_KEY);
