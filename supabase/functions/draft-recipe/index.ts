// AI-Assisted Recipe Costing — draft step (see RECIPE_COSTING.md §4).
//
// Mirrors extract-invoice: the client creates a draft `recipes` row (and
// optionally uploads a photo to the private recipe-images bucket), then invokes
// this with { recipeId }. We ask Claude for a TEMPLATE ingredient list (the
// operator will confirm/adjust every quantity), write it to ai_draft_raw + draft
// recipe_ingredients rows, and return. This is the ONLY Claude spend in the
// whole feature — once confirmed, costing is pure SQL over existing invoices.
//
// Pro-only, enforced server-side. Deploy with verify_jwt = false (the Clerk
// token is validated via RLS on the queries below).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getOrganization } from '../_shared/clerkAuth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODEL_SONNET = 'claude-sonnet-5';

// Note what's deliberately ABSENT: no batch_yield field. Yield is operator-set
// only (see spec §4) — structurally omitting it means the model can't guess it.
const RECIPE_DRAFT_TOOL = {
  name: 'record_recipe_draft',
  description:
    'Record a starting-point recipe TEMPLATE for a restaurant dish. This is a rough draft the operator will confirm and adjust — never presume it is their actual recipe.',
  input_schema: {
    type: 'object',
    properties: {
      normalized_name: { type: 'string', description: 'A clean, canonical name for the dish' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            raw_name: {
              type: 'string',
              description:
                'A specific, purchasable ingredient name (e.g. "boneless chicken thigh", not "chicken") so it can be matched to invoice history',
            },
            approx_qty: { type: 'number', description: 'Rough quantity per single plated serving' },
            unit: { type: 'string', description: 'One of: g | oz | lb | ml | floz | cup | tbsp | tsp | each' },
            is_likely_prep: {
              type: 'boolean',
              description:
                'true if this is itself a multi-ingredient prep component (sauce, stock, marinade, dressing, batter) rather than a single purchased good',
            },
            est_cost_share: {
              type: 'number',
              description: '0-1 rough share of this dish’s total ingredient cost; shares should sum to ~1',
            },
          },
          required: ['raw_name', 'approx_qty', 'unit', 'is_likely_prep', 'est_cost_share'],
        },
      },
      draft_confidence: { type: 'number', description: '0-1 confidence this is a reasonable starting template' },
    },
    required: ['normalized_name', 'ingredients', 'draft_confidence'],
  },
};

function buildPrompt(dishName: string, hasPhoto: boolean): string {
  return `You are drafting a starting-point recipe TEMPLATE for a restaurant dish${dishName ? ` called "${dishName}"` : ''}. This is NOT the operator's actual recipe — it's a rough template they will confirm and adjust ingredient by ingredient.

${hasPhoto ? 'A photo of the plated dish is attached — use what you can see, cross-referenced with general knowledge of the named dish.\n\n' : ''}Rules:
- Give quantities per SINGLE plated serving.
- Prefer specific, purchasable ingredient names ("boneless chicken thigh", not "chicken") so each can be matched against the restaurant's real invoice history.
- If an ingredient is itself a compound prep component (a sauce, stock, marinade, dressing, batter), do NOT expand it inline — list it as one ingredient and set is_likely_prep = true.
- est_cost_share values should sum to roughly 1 across the whole list, reflecting each ingredient's rough share of the dish's ingredient cost.
- Never invent oddly precise numbers; these are estimates the operator will refine.

Call record_recipe_draft with the complete template.`;
}

async function storagePathToBase64(supabase: any, path: string): Promise<{ data: string; mediaType: string }> {
  const { data: signed, error } = await supabase.storage.from('recipe-images').createSignedUrl(path, 60);
  if (error || !signed) throw new Error(`Could not sign recipe image URL: ${error?.message}`);
  const res = await fetch(signed.signedUrl);
  if (!res.ok) throw new Error(`Could not fetch recipe image: ${res.status}`);
  const mediaType = res.headers.get('content-type') ?? 'image/jpeg';
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { data: btoa(binary), mediaType };
}

interface RecipeDraft {
  normalized_name: string;
  ingredients: Array<{
    raw_name: string;
    approx_qty: number;
    unit: string;
    is_likely_prep: boolean;
    est_cost_share: number;
  }>;
  draft_confidence: number;
}

async function draftWithModel(dishName: string, images: { data: string; mediaType: string }[]): Promise<RecipeDraft> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL_SONNET,
      max_tokens: 2048,
      tools: [RECIPE_DRAFT_TOOL],
      tool_choice: { type: 'tool', name: 'record_recipe_draft' },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
            { type: 'text', text: buildPrompt(dishName, images.length > 0) },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }
  const json = await res.json();
  const toolUse = json.content?.find((b: any) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a recipe draft.');
  return toolUse.input as RecipeDraft;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { recipeId } = await req.json();
    if (!recipeId) throw new Error('recipeId is required');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: recipe, error: fetchErr } = await supabase
      .from('recipes')
      .select('id, organization_id, name, source_photo_path')
      .eq('id', recipeId)
      .single();
    if (fetchErr || !recipe) throw new Error(`Recipe not found: ${fetchErr?.message}`);

    // Recipe costing is Pro-only — enforce server-side before any Claude spend.
    let isPro = false;
    try {
      const org = await getOrganization(recipe.organization_id);
      isPro = org?.public_metadata?.plan === 'pro';
    } catch {
      isPro = false;
    }
    if (!isPro) {
      return new Response(
        JSON.stringify({ error: 'Recipe costing is a Pro feature.', code: 'PRO_REQUIRED' }),
        { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    const images = recipe.source_photo_path
      ? [await storagePathToBase64(supabase, recipe.source_photo_path)]
      : [];

    const draft = await draftWithModel(recipe.name ?? '', images);

    const { data: updatedRecipe, error: updateErr } = await supabase
      .from('recipes')
      .update({
        name: recipe.name || draft.normalized_name,
        ai_draft_raw: draft,
        draft_model: 'sonnet_5',
      })
      .eq('id', recipeId)
      .select()
      .single();
    if (updateErr) throw new Error(`Could not save draft: ${updateErr.message}`);

    // Phase 1: every drafted ingredient is a plain item (no prep expansion yet).
    const ingredientRows = draft.ingredients.map((ing, i) => ({
      organization_id: recipe.organization_id,
      recipe_id: recipeId,
      component_type: 'item',
      raw_ingredient_name: ing.raw_name,
      qty: ing.approx_qty,
      unit: ing.unit,
      ai_qty: ing.approx_qty,
      ai_unit: ing.unit,
      ai_est_cost_share: ing.est_cost_share,
      confirmed: false,
      position: i,
    }));

    const { data: insertedIngredients, error: ingErr } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientRows)
      .select();
    if (ingErr) throw new Error(`Could not save ingredients: ${ingErr.message}`);

    return new Response(
      JSON.stringify({ recipe: updatedRecipe, ingredients: insertedIngredients }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
