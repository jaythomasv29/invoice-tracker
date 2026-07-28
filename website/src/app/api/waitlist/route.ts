import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Conservative email shape check — not RFC-perfect, just enough to reject
// empty/obviously-malformed input before it hits the database.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Postgres unique_violation. The unique index is on lower(email), so a repeat
// signup (any casing) lands here and we treat it as success — "you're on the
// list" should feel the same whether it's your first time or your fifth.
const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, source } =
    (body as { email?: unknown; source?: unknown }) ?? {};

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const normalizedSource =
    typeof source === "string" && source.trim() ? source.trim().slice(0, 64) : null;

  // Create the service-role client inside the handler (not at module scope) so
  // the build doesn't require real env vars, and so the key is never bundled
  // into anything client-facing.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    // Misconfiguration — log server-side, stay vague to the client.
    console.error("Waitlist: missing Supabase env vars.");
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("waitlist_signups")
    .insert({ email: normalizedEmail, source: normalizedSource });

  if (error) {
    // Already on the list — that's a success from the user's perspective.
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ ok: true, alreadyOnList: true }, { status: 200 });
    }
    // Don't leak database internals to the client.
    console.error("Waitlist insert failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
