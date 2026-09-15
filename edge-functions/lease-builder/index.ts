
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface ClauseOption {
  key: string;
  label: string;
  value: string;
}

interface ClauseDefinition {
  id: string;
  clause_key: string;
  label: string;
  description: string;
  default_text: string;
  sort_order: number;
  is_required: boolean;
  options: ClauseOption[] | null;
}

interface LeaseTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  metadata: Record<string, any>;
}

interface TemplateClause {
  clause_id: string;
  sort_order: number;
  is_required: boolean;
  clause: ClauseDefinition;
}

interface BuildRequest {
  template_id?: string;
  template_name?: string;
  tenant_name: string;
  landlord_name: string;
  property_address: string;
  lease_start_date: string;
  lease_end_date: string;
  base_rent_amount: number;
  base_rent_frequency?: string;
  security_deposit_amount?: number;
  custom_clauses?: Record<string, string>;
  options?: Record<string, string>;
}

interface BuiltLease {
  id: string;
  template_name: string;
  template_category: string;
  tenant: string;
  landlord: string;
  property: string;
  term: { start: string; end: string };
  financials: { base_rent: number; frequency: string; security_deposit: number };
  clauses: Array<{ key: string; label: string; text: string; sort_order: number }>;
  metadata: { built_at: string; version: string; clause_count: number };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const body: BuildRequest = await req.json();

    // Validate required fields
    if (!body.tenant_name || !body.landlord_name || !body.property_address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_name, landlord_name, property_address" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Resolve template
    let template: LeaseTemplate | null = null;
    if (body.template_id) {
      const { data, error } = await supabase
        .from("lease_templates")
        .select("*")
        .eq("id", body.template_id)
        .single();
      if (error) throw error;
      template = data;
    } else if (body.template_name) {
      const { data, error } = await supabase
        .from("lease_templates")
        .select("*")
        .ilike("name", `%${body.template_name}%`)
        .single();
      if (error) throw error;
      template = data;
    } else {
      // Default to first template
      const { data, error } = await supabase
        .from("lease_templates")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      template = data;
    }

    if (!template) {
      return new Response(
        JSON.stringify({ error: "No lease template found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch all clauses for this template
    const { data: templateClauses, error: tcError } = await supabase
      .from("template_clauses")
      .select("clause_id, sort_order, is_required")
      .eq("template_id", template.id)
      .order("sort_order");

    if (tcError) throw tcError;

    // Fetch clause definitions
    const clauseIds = templateClauses.map((tc: any) => tc.clause_id);
    const { data: clauses, error: cError } = await supabase
      .from("clause_definitions")
      .select("*")
      .in("id", clauseIds);

    if (cError) throw cError;

    // Build clause map
    const clauseMap = new Map<string, ClauseDefinition>();
    for (const c of clauses || []) {
      clauseMap.set(c.id, c);
    }

    // Assemble clauses with rendered text
    const assembledClauses = [];
    for (const tc of templateClauses || []) {
      const clause = clauseMap.get(tc.clause_id);
      if (!clause) continue;

      let text = clause.default_text;

      // Replace template variables
      text = text.replace(/\{\{tenant_name\}\}/g, body.tenant_name);
      text = text.replace(/\{\{landlord_name\}\}/g, body.landlord_name);
      text = text.replace(/\{\{property_address\}\}/g, body.property_address);
      text = text.replace(/\{\{lease_start_date\}\}/g, body.lease_start_date || "");
      text = text.replace(/\{\{lease_end_date\}\}/g, body.lease_end_date || "");
      text = text.replace(/\{\{base_rent_amount\}\}/g, String(body.base_rent_amount || 0));
      text = text.replace(/\{\{security_deposit_amount\}\}/g, String(body.security_deposit_amount || 0));

      // Apply custom clause overrides
      if (body.custom_clauses && body.custom_clauses[clause.clause_key]) {
        text = body.custom_clauses[clause.clause_key];
      }

      // Apply option selections
      if (body.options && body.options[clause.clause_key]) {
        const selectedOption = body.options[clause.clause_key];
        if (clause.options) {
          const option = clause.options.find((o: ClauseOption) => o.key === selectedOption);
          if (option) {
            text = option.value;
          }
        }
      }

      assembledClauses.push({
        key: clause.clause_key,
        label: clause.label,
        text: text,
        sort_order: tc.sort_order,
      });
    }

    // Build the lease document
    const lease: BuiltLease = {
      id: crypto.randomUUID(),
      template_name: template.name,
      template_category: template.category,
      tenant: body.tenant_name,
      landlord: body.landlord_name,
      property: body.property_address,
      term: {
        start: body.lease_start_date || "",
        end: body.lease_end_date || "",
      },
      financials: {
        base_rent: body.base_rent_amount || 0,
        frequency: body.base_rent_frequency || "monthly",
        security_deposit: body.security_deposit_amount || 0,
      },
      clauses: assembledClauses,
      metadata: {
        built_at: new Date().toISOString(),
        version: "1.0.0",
        clause_count: assembledClauses.length,
      },
    };

    return new Response(
      JSON.stringify({ success: true, lease, template: { id: template.id, name: template.name } }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
