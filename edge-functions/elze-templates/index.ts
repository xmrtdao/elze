// Elze Templates — relay proxy edge function
//
// elze-templates is a relay-native function (relay/functions/elze-templates.mjs)
// that reads the canonical DB tables (public.lease_templates, clause_definitions,
// template_clauses) directly. This edge function is a thin proxy so agents and
// frontends can reach it through the Supabase edge-function gateway too.
//
// Actions: templates | template {id} | clauses {template_id} | search {q, category}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RELAY_URL = Deno.env.get("RELAY_URL") || "http://127.0.0.1:8080";
const RELAY_API_KEY = Deno.env.get("RELAY_API_KEY") || "";

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const relayRes = await fetch(`${RELAY_URL}/api/v1/functions/elze-templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RELAY_API_KEY,
        "x-agent-id": "hermes",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await relayRes.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: relayRes.ok ? 200 : relayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
