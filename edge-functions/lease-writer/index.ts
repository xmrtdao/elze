// Follow your setup instructions at https://supabase.com/docs/guides/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface LeaseDocument {
  template_id: string;
  template_name: string;
  category: string;
  clauses: Record<string, string>;
  metadata: Record<string, unknown>;
}

interface WriterRequest {
  action: "render" | "preview" | "export";
  lease: LeaseDocument;
  format?: "html" | "markdown" | "text";
  tenant_name?: string;
  landlord_name?: string;
  property_address?: string;
  effective_date?: string;
}

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: WriterRequest = await req.json();
    const { action, lease, format = "html", tenant_name, landlord_name, property_address, effective_date } = body;

    if (!lease || !lease.clauses) {
      return new Response(
        JSON.stringify({ error: "Missing lease data with clauses" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the rendered document
    const doc = buildDocument(lease, { tenant_name, landlord_name, property_address, effective_date });

    switch (action) {
      case "render":
        if (format === "html") {
          return new Response(
            JSON.stringify({ success: true, format: "html", content: renderHTML(doc) }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (format === "markdown") {
          return new Response(
            JSON.stringify({ success: true, format: "markdown", content: renderMarkdown(doc) }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ success: true, format: "text", content: renderText(doc) }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

      case "preview":
        return new Response(
          JSON.stringify({
            success: true,
            format: "preview",
            content: renderHTML(doc),
            summary: {
              template: lease.template_name,
              category: lease.category,
              clause_count: Object.keys(lease.clauses).length,
              parties: `${doc.landlord_name} / ${doc.tenant_name}`,
              property: doc.property_address,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "export":
        // Store the rendered document in the database
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data, error } = await supabase
          .from("lease_documents")
          .insert({
            template_id: lease.template_id,
            template_name: lease.template_name,
            category: lease.category,
            clauses: lease.clauses,
            metadata: lease.metadata,
            tenant_name: doc.tenant_name,
            landlord_name: doc.landlord_name,
            property_address: doc.property_address,
            effective_date: doc.effective_date,
            rendered_html: renderHTML(doc),
            rendered_markdown: renderMarkdown(doc),
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            action: "exported",
            document_id: data.id,
            format: "html+markdown",
            summary: {
              template: lease.template_name,
              clause_count: Object.keys(lease.clauses).length,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      default:
        return new Response(
          JSON.stringify({ error: \`Unknown action: \${action}\` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface DocContext {
  tenant_name?: string;
  landlord_name?: string;
  property_address?: string;
  effective_date?: string;
}

interface RenderedDoc {
  template_name: string;
  category: string;
  clauses: Record<string, string>;
  tenant_name: string;
  landlord_name: string;
  property_address: string;
  effective_date: string;
}

function buildDocument(lease: LeaseDocument, ctx: DocContext): RenderedDoc {
  return {
    template_name: lease.template_name,
    category: lease.category,
    clauses: lease.clauses,
    tenant_name: ctx.tenant_name || "[TENANT NAME]",
    landlord_name: ctx.landlord_name || "[LANDLORD NAME]",
    property_address: ctx.property_address || "[PROPERTY ADDRESS]",
    effective_date: ctx.effective_date || new Date().toISOString().split("T")[0],
  };
}

function renderHTML(doc: RenderedDoc): string {
  const clausesHtml = Object.entries(doc.clauses)
    .map(([key, value]) => \`<div class="clause">\n    <h3>\${key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</h3>\n    <p>\${value}</p>\n  </div>\`)
    .join("\n  ");

  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lease Agreement - \${doc.template_name}</title>
  <style>
    body { font-family: "Georgia", serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #1a1a1a; }
    h1 { text-align: center; font-size: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header p { margin: 4px 0; font-size: 14px; }
    .clause { margin-bottom: 20px; }
    .clause h3 { font-size: 16px; margin-bottom: 6px; color: #2c3e50; }
    .clause p { margin: 0; font-size: 14px; text-align: justify; }
    .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; font-size: 12px; text-align: center; color: #666; }
  </style>
</head>
<body>
  <h1>LEASE AGREEMENT</h1>
  <div class="header">
    <p><strong>Template:</strong> \${doc.template_name}</p>
    <p><strong>Category:</strong> \${doc.category}</p>
    <p><strong>Landlord:</strong> \${doc.landlord_name}</p>
    <p><strong>Tenant:</strong> \${doc.tenant_name}</p>
    <p><strong>Property:</strong> \${doc.property_address}</p>
    <p><strong>Effective Date:</strong> \${doc.effective_date}</p>
  </div>
  <hr>
  \${clausesHtml}
  <div class="footer">
    <p>This lease agreement was generated by the XMRT-DAO Lease Writer.</p>
    <p>Generated on: \${new Date().toISOString().split("T")[0]}</p>
  </div>
</body>
</html>\`;
}

function renderMarkdown(doc: RenderedDoc): string {
  const clausesMd = Object.entries(doc.clauses)
    .map(([key, value]) => \`### \${key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}\n\n\${value}\n\`)
    .join("\n---\n\n");

  return \`# LEASE AGREEMENT\n\n**Template:** \${doc.template_name}\n**Category:** \${doc.category}\n**Landlord:** \${doc.landlord_name}\n**Tenant:** \${doc.tenant_name}\n**Property:** \${doc.property_address}\n**Effective Date:** \${doc.effective_date}\n\n---\n\n\${clausesMd}\n\n---\n\n*Generated by XMRT-DAO Lease Writer on \${new Date().toISOString().split("T")[0]}*\n\`;
}

function renderText(doc: RenderedDoc): string {
  const clausesText = Object.entries(doc.clauses)
    .map(([key, value]) => \`\${key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}\n\${value}\n\`)
    .join("---\n");

  return \`LEASE AGREEMENT\n\nTemplate: \${doc.template_name}\nCategory: \${doc.category}\nLandlord: \${doc.landlord_name}\nTenant: \${doc.tenant_name}\nProperty: \${doc.property_address}\nEffective Date: \${doc.effective_date}\n\n---\n\n\${clausesText}\n\n---\n\nGenerated by XMRT-DAO Lease Writer\n\`;
}
