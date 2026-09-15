// lease_analyzer/index.ts — VA Lease Compliance Edge Function
// Proxies to the relay's working lease-analyzer local function
// Passes through the full relay response format so agents get
// the complete redline data, not a stripped-down version.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RELAY_URL = "http://127.0.0.1:8080";
const RELAY_API_KEY = Deno.env.get("RELAY_API_KEY") || "3a02d6eecc89f1c700c097f9034479c24a56787acfbc996c5d17086ecd364602";

interface LeaseAnalysisRequest {
  lease_text?: string;
  document?: string;
  documentType?: string;
  documentName?: string;
  attorney?: string;
  attorney_id?: string;
  attorney_name?: string;
  perspective?: "landlord" | "tenant";
  // File upload fields (forwarded to relay for structured table/image extraction)
  fileContent?: string;
  fileName?: string;
  mimeType?: string;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  
  const body: LeaseAnalysisRequest = await req.json();
  const textToAnalyze = body.lease_text || body.document || "";
  // If a file is provided, forward it so the relay can do structured
  // table/image extraction. Otherwise fall back to plain text.
  const hasFile = !!body.fileContent;
  if (!textToAnalyze && !hasFile) return new Response(JSON.stringify({ error: "lease_text, document, or fileContent required" }), { status: 400 });

  try {
    // Proxy to the relay's working lease-analyzer local function
    const relayBody: Record<string, unknown> = {
      documentType: body.documentType || "lease",
      documentName: body.documentName || "lease_analyzer_edge_function",
    };
    // Forward attorney identity so the preference-aware learning loop applies
    if (body.attorney || body.attorney_id || body.attorney_name) {
      relayBody.attorney = body.attorney || body.attorney_id || body.attorney_name;
      if (body.attorney_id) relayBody.attorney_id = body.attorney_id;
      if (body.attorney_name) relayBody.attorney_name = body.attorney_name;
    }
    if (hasFile) {
      relayBody.fileContent = body.fileContent;
      relayBody.fileName = body.fileName || "uploaded.docx";
      relayBody.mimeType = body.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      relayBody.document = textToAnalyze;
    }
    const relayResp = await fetch(`${RELAY_URL}/api/v1/functions/lease-analyzer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RELAY_API_KEY,
      },
      body: JSON.stringify(relayBody),
      signal: AbortSignal.timeout(25000),
    });

    if (!relayResp.ok) {
      const errText = await relayResp.text().catch(() => "Unknown error");
      return new Response(JSON.stringify({ error: `Relay proxy failed: ${relayResp.status}`, detail: errText.slice(0, 500) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pass through the full relay response format — includes:
    // success, status, documentInfo (type, detectedType, jurisdiction, rawText),
    // compliance (score, grade, critical, high, medium, suggestion),
    // findings[], redlines[], redlinedHtml, warnings, summary, clauses
    const relayData = await relayResp.json();
    
    return new Response(JSON.stringify(relayData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Proxy failed: ${e.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
