import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, requireAiConsent } from "../_shared/aiControls.ts";
import { getOrganization, getVerifiedOrgId } from "../_shared/clerkAuth.ts";
import {
  forecastReorder,
  allowedInsightAction,
  FORECAST_REASONS,
} from "../../../shared/reorderForecast.ts";
import type { PurchaseObservation } from "../../../shared/measurement.ts";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  let job: string | undefined;
  try {
    const auth = req.headers.get("Authorization");
    const workspace = await getVerifiedOrgId(
      auth,
      req.headers.get("x-sift-workspace"),
    );
    if (!workspace)
      return reply(
        { error: "Sign in to a workspace.", code: "UNAUTHORIZED" },
        401,
      );
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: auth!, "x-sift-workspace": workspace },
        },
      },
    );
    const org = await getOrganization(workspace);
    if (!["pro", "plus"].includes(org.public_metadata?.plan))
      return reply(
        {
          error: "AI product reviews are a Pro feature.",
          code: "PRO_REQUIRED",
        },
        403,
      );
    await requireAiConsent(db);
    const { key } = await req.json();
    if (typeof key !== "string" || key.length < 1 || key.length > 4096)
      return reply({ error: "Choose a purchased product." }, 400);
    const { data, error } = await db.rpc("purchase_product_history", {
      p_key: key,
      p_limit: 100,
      p_offset: 0,
    });
    if (error || !data?.length)
      return reply({ error: "Saved product history was not found." }, 404);
    const rows = data as PurchaseObservation[];
    const facts = forecastReorder(rows);
    const action = allowedInsightAction(facts);
    // Model sees only derived evidence, never invoice photos, names, addresses or raw descriptions.
    const { unit: _unit, ...patternEvidence } = facts;
    const evidence = {
      ...patternEvidence,
      asOf: new Date().toISOString().slice(0, 10),
      stockKnown: false,
    };
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify({
          workspace,
          key,
          evidence,
          rows: rows.map((r) => [
            r.id,
            r.qty,
            r.extended_price,
            r.invoices.invoice_date,
          ]),
        }),
      ),
    );
    const hash = [...new Uint8Array(bytes)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const { data: reservation, error: reserveError } = await adminClient().rpc(
      "reserve_product_insight",
      { p_org: workspace, p_hash: hash },
    );
    if (reserveError) throw reserveError;
    if (!reservation?.allowed)
      return reply(
        {
          error:
            reservation?.code === "AI_BUSY"
              ? "This product review is already running. Please retry shortly."
              : "AI review limit reached. Try again later. Product history remains available.",
          code: reservation?.code,
        },
        429,
      );
    if (reservation.cached)
      return reply({ ...reservation.cached, cached: true });
    job = reservation.id;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 256,
        system:
          "Review recorded product buying patterns. Inventory and consumption are unknown. Use only provided evidence. A timing window is a stock-check cue, never a guaranteed order date. Never recommend a purchase quantity or infer stock. Select the permitted action and the most useful supported focus. Return the tool only.",
        messages: [{ role: "user", content: JSON.stringify(evidence) }],
        tools: [
          {
            name: "review_purchase_pattern",
            description: "Grounded product-history review.",
            input_schema: {
              type: "object",
              properties: {
                action: { type: "string", enum: [action] },
                focus: {
                  type: "string",
                  enum: ["timing", "quantity", "history", "identity"],
                },
              },
              required: ["action", "focus"],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: { type: "tool", name: "review_purchase_pattern" },
      }),
    });
    if (!response.ok) throw new Error("AI service unavailable");
    const payload = await response.json();
    const tool = payload.content?.find(
      (c: { type: string; name?: string }) =>
        c.type === "tool_use" && c.name === "review_purchase_pattern",
    );
    if (
      tool?.input?.action !== action ||
      !["timing", "quantity", "history", "identity"].includes(
        tool?.input?.focus,
      )
    )
      throw new Error("AI review could not be validated");
    // User-facing facts and dates are always generated from verified evidence, not model prose.
    const focus = tool.input.focus as string;
    const focusNote =
      focus === "quantity" && facts.lastQuantity != null
        ? "Compare your last purchased quantity with stock on hand."
        : focus === "identity"
          ? "Keep product descriptions and package sizes consistent for clearer comparisons."
          : focus === "history"
            ? "Save and review dated purchases to strengthen this history."
            : "Check recorded purchase dates against your next planned stock review.";
    const result = {
      action,
      summary: FORECAST_REASONS[facts.status],
      focusNote,
      facts,
      generatedAt: new Date().toISOString(),
      model: "claude-sonnet-5",
    };
    // Consent and scope can be revoked while the model runs; never return or cache after revocation.
    await requireAiConsent(db);
    if ((await getVerifiedOrgId(auth, workspace)) !== workspace)
      throw new Error("Workspace unavailable");
    const { error: saveError } = await adminClient()
      .from("product_insight_jobs")
      .update({ status: "complete", result })
      .eq("id", job)
      .eq("organization_id", workspace);
    if (saveError) throw saveError;
    return reply(result);
  } catch {
    if (job)
      await adminClient()
        .from("product_insight_jobs")
        .update({ status: "failed" })
        .eq("id", job);
    return reply(
      {
        error:
          "Could not complete this AI review. Check AI permission in Profile and retry. Your purchase history is still available.",
      },
      503,
    );
  }
});
