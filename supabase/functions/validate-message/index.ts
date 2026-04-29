import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ValidateMessageRequest {
  booking_id: string;
  content: string;
}

interface DetectionResult {
  type: string;
  match: string;
  start: number;
  end: number;
}

const PATTERNS: Array<{ type: string; regex: RegExp; minLen?: number }> = [
  // 8+ digits in a row, with optional + and separators (.-/space)
  { type: "phone", regex: /(?:\+?\d[\s.\-/]?){8,}\d/g },
  // Email RFC-ish
  { type: "email", regex: /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi },
  // Social platforms / messaging apps by name
  {
    type: "social_app",
    regex:
      /\b(whats?\s*app|wa\.me|tele\s*gram|t\.me|insta\s*gram|tik\s*tok|messenger|signal|viber|skype|i\s*message)\b/gi,
  },
  // @handles 4+ chars (excluding emails which are caught above)
  { type: "social_handle", regex: /(?:^|[^a-z0-9._@])@[a-z0-9._]{4,}/gi },
  // URLs http(s)/www
  { type: "url", regex: /\b(?:https?:\/\/|www\.)[\w.\-]+\.[a-z]{2,}(?:\/\S*)?/gi },
  // Italian IBAN (with optional spaces)
  {
    type: "iban",
    regex: /\bIT\d{2}\s?[A-Z]\s?\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}\b/gi,
  },
  // Off-platform payment hints (Italian + EN)
  {
    type: "off_platform_payment",
    regex:
      /\b(pay\s*pal|satis\s*pay|poste\s*pay|bonifico|revolut|venmo|zelle|cash\s*app|fuori\s+(?:app|piattaforma|da\s+qui))\b/gi,
  },
];

const FRIENDLY_MESSAGES: Record<string, string> = {
  phone:
    "Per la tua sicurezza non puoi scambiare numeri di telefono in chat. Coordinati direttamente da qui.",
  email:
    "Non condividere email in chat. CleanHome ti protegge solo se le comunicazioni restano qui.",
  social_app:
    "Non puoi proporre di spostare la conversazione su altre app. Continua qui.",
  social_handle:
    "Non condividere profili social in chat.",
  url: "I link esterni non sono permessi in chat.",
  iban:
    "I pagamenti vanno fatti solo dentro l'app. Non condividere IBAN.",
  off_platform_payment:
    "I pagamenti devono passare da CleanHome. Non puoi proporre pagamenti fuori piattaforma.",
};

function detectViolations(content: string): DetectionResult[] {
  const detections: DetectionResult[] = [];
  for (const { type, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      detections.push({
        type,
        match: m[0],
        start: m.index,
        end: m.index + m[0].length,
      });
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  }
  return detections;
}

function redact(content: string, detections: DetectionResult[]): string {
  if (detections.length === 0) return content;
  const sorted = [...detections].sort((a, b) => b.start - a.start);
  let result = content;
  for (const d of sorted) {
    result = result.slice(0, d.start) + "▮▮▮" + result.slice(d.end);
  }
  return result;
}

const ALLOWED_ORIGINS = ["*"];
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    const jwt = authHeader.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return jsonResponse({ error: "server_misconfigured" }, 500);
    }

    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt);
    if (authError || !user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    let payload: ValidateMessageRequest;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_body" }, 400);
    }

    const { booking_id, content } = payload ?? {};
    if (
      typeof booking_id !== "string" ||
      typeof content !== "string" ||
      content.trim().length === 0 ||
      content.length > 4000
    ) {
      return jsonResponse({ error: "invalid_fields" }, 400);
    }

    const { data: booking, error: bookingErr } = await adminClient
      .from("bookings")
      .select("id, client_id, cleaner_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingErr || !booking) {
      return jsonResponse({ error: "booking_not_found" }, 404);
    }
    if (booking.client_id !== user.id && booking.cleaner_id !== user.id) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const detections = detectViolations(content);

    if (detections.length > 0) {
      const primary = detections[0].type;
      const redacted = redact(content, detections);

      await adminClient.from("contact_violations").insert({
        user_id: user.id,
        booking_id,
        content,
        redacted_text: redacted,
        violation_type: primary,
      });

      return jsonResponse(
        {
          blocked: true,
          violation_type: primary,
          message:
            FRIENDLY_MESSAGES[primary] ??
            "Il messaggio contiene riferimenti non permessi e non è stato inviato.",
        },
        422
      );
    }

    const { data: inserted, error: insertErr } = await adminClient
      .from("messages")
      .insert({
        booking_id,
        sender_id: user.id,
        content,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      return jsonResponse({ error: "insert_failed" }, 500);
    }

    return jsonResponse({ blocked: false, message: inserted }, 200);
  } catch (_err) {
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
