// ============================================================================
// Edge Function: support-chat
// ----------------------------------------------------------------------------
// AI customer support chat backed by Anthropic Claude.
//
// Modes:
//   - { action: "send", chat_id?, content }
//       → ensures chat exists, persists user msg, calls Claude with full
//         history + CleanHome FAQ system prompt, persists assistant reply,
//         returns reply (or escalation flag).
//   - { action: "escalate", chat_id, reason? }
//       → marks chat escalated_at, sends email to support team with full
//         transcript via Resend (if configured).
//   - { action: "history", chat_id? }
//       → returns last 100 messages for the user's most recent chat.
//
// Auth: user JWT (verify_jwt=true).
//
// Required Supabase secrets:
//   ANTHROPIC_API_KEY  — from console.anthropic.com (Sonnet 4.6)
//   RESEND_API_KEY     — optional, used by escalation email
//   SUPPORT_EMAIL      — destination for escalations (default: support@cleanhome.it)
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") ?? "support@cleanhome.it";

// Default to Haiku 4.5 — 5x cheaper than Sonnet, quality is more than enough
// for the kind of FAQ questions a cleaning marketplace gets. Override via
// ANTHROPIC_MODEL env var if you want to switch up later.
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5";
const MAX_HISTORY = 30;
const MAX_INPUT_LENGTH = 4000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Sei l'assistente virtuale di CleanHome, la piattaforma marketplace italiana per servizi di pulizia domestica. Rispondi sempre in italiano, in modo chiaro, cordiale, conciso (max 4-5 frasi).

# Cosa fa CleanHome
- Marketplace che mette in contatto clienti con cleaner verificati (P.IVA italiana)
- Cliente prenota → paga subito → cleaner accetta → esegue → cliente conferma → cleaner riceve pagamento
- Pagamenti gestiti da Stripe Connect (PCI-DSS Level 1)

# Modello di pagamento (escrow hold-until-confirm)
- L'addebito sulla carta del cliente è IMMEDIATO al momento della prenotazione
- I fondi restano custoditi da CleanHome (escrow), NON vanno al cleaner
- Quando il cleaner segna "Lavoro completato", parte una finestra di 48 ore
- Entro 48h il cliente deve: (a) confermare il servizio, oppure (b) aprire una contestazione
- Senza azione del cliente entro 48h, il pagamento viene auto-rilasciato al cleaner
- Il cleaner riceve i fondi sul suo conto Stripe Connect entro 2-3 giorni lavorativi

# Commissioni
- Cliente paga: prezzo servizio + 9% commissione
- Cleaner riceve: prezzo servizio − 9% commissione
- Commissione totale CleanHome: 18%

# Prezzi
- €1,30 al m², minimo €50

# Cancellazioni e rimborsi
- Più di 24h prima del servizio → rimborso completo
- Tra 24h e 2h prima → rimborso 50%
- Meno di 2h o no-show → nessun rimborso
- Se nessun cleaner accetta entro 20 min totali → rimborso automatico completo
- Il rimborso è triggered immediatamente da CleanHome, ma l'accredito sulla carta dipende dalla banca emittente: tipicamente 3-7 giorni lavorativi, in alcuni casi fino a 10. Se dopo 10 giorni l'accredito non è arrivato, l'utente deve contattare la propria banca.

# Contestazioni in-app
- Il cliente apre una contestazione dalla schermata booking → "Segnala problema"
- Deve caricare almeno 1 foto + descrizione (min 20 caratteri)
- I fondi restano congelati su CleanHome
- CleanHome esamina entro 5 giorni lavorativi e decide rimborso totale, parziale, o conferma del pagamento

# Chat anti-bypass
- Vietato condividere numeri di telefono, email personali, profili social, riferimenti a WhatsApp/Telegram in chat con il cleaner
- I tentativi vengono bloccati automaticamente

# Cleaner
- Devono avere P.IVA italiana attiva
- Verifica KYC tramite Stripe Connect Express
- Possono pubblicare 1 listing gratis, listings aggiuntivi €4,99/mese

# QUANDO ESCALARE A UN UMANO
Se l'utente:
- Segnala danni a oggetti / proprietà ("rotto", "danneggiato", "ha rovinato")
- Riporta un addebito errato / duplicato
- Ha un problema legale / chargeback / denuncia
- Vuole cancellare l'account e i dati (GDPR)
- Esprime frustrazione molto forte ("schifo", "denuncio", "truffa", "rubato")
- Riporta comportamento inappropriato del cleaner
- Ha un problema che richiede intervento manuale (es. transfer Stripe bloccato)

In questi casi: NON tentare di risolvere da solo, dì che il caso richiede un operatore umano e suggerisci di toccare il bottone "Parla con un operatore" in alto. Non promettere tempi se non sai.

# COSA NON FARE MAI
- Inventare dati specifici dell'utente (booking ID, importi, date) — chiedi all'utente di guardare nell'app
- Promettere rimborsi specifici — può deciderli solo l'operatore in caso di contestazione
- Dare consigli legali o fiscali al cleaner (rivolgiti al tuo commercialista)
- Condividere link esterni
- Usare emoji eccessive

Se l'utente saluta o ringrazia, sii cordiale e breve. Se chiede qualcosa fuori dal tuo ambito (meteo, news, ecc.), spiega gentilmente che gestisci solo CleanHome.`;

const ESCALATION_KEYWORDS = [
  "rotto", "danneggiato", "rovinato", "rovinata", "rotti", "rotta",
  "addebito errato", "addebito doppio", "addebito sbagliato", "doppio addebito",
  "denuncia", "denuncio", "denuncerò", "querela", "avvocato",
  "truffa", "truffatori", "ladro", "ladri", "rubato", "rubati",
  "schifo", "vergogna", "imbroglio", "imbrogliato",
  "molestato", "molestie", "aggressivo", "minaccia", "minacciato",
  "chiudere account", "elimina dati", "cancella tutto", "diritto oblio",
  "transfer bloccato", "soldi spariti", "mai arrivato",
];

function detectEscalation(content: string): string | null {
  const lc = content.toLowerCase();
  for (const kw of ESCALATION_KEYWORDS) {
    if (lc.includes(kw)) return kw;
  }
  return null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function callClaude(history: ChatMessage[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "Il servizio di assistenza AI non è ancora configurato. Tocca \"Parla con un operatore\" per scrivere via email al nostro team.";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }, // 5-min prompt cache
        },
      ],
      messages: history,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[support-chat] Anthropic error:", res.status, errText);
    return "Mi dispiace, sto avendo un problema tecnico. Riprova tra qualche minuto o tocca \"Parla con un operatore\".";
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return "Mi dispiace, non sono riuscito a generare una risposta. Tocca \"Parla con un operatore\" per ricevere aiuto.";
  }
  return text.trim();
}

async function sendEscalationEmail(args: {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  chatId: string;
  reason: string;
  transcript: ChatMessage[];
}) {
  if (!RESEND_API_KEY) {
    console.warn("[support-chat] RESEND_API_KEY missing — escalation email skipped");
    return;
  }

  const transcriptText = args.transcript
    .map((m) => `${m.role === "user" ? "UTENTE" : "AI"}: ${m.content}`)
    .join("\n\n");

  const subject = `[CleanHome Support] Escalation chat ${args.chatId.slice(0, 8)}`;
  const html = `
    <h2>Nuova escalation supporto</h2>
    <p><strong>Chat ID:</strong> ${args.chatId}</p>
    <p><strong>Utente:</strong> ${args.userName ?? "(no name)"} — ${args.userEmail ?? "(no email)"}</p>
    <p><strong>User ID:</strong> ${args.userId}</p>
    <p><strong>Motivo escalation:</strong> ${args.reason}</p>
    <hr/>
    <h3>Transcript</h3>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#f6f8fa;padding:12px;border-radius:8px;">${
      transcriptText.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }</pre>
    <hr/>
    <p>Rispondi direttamente all'utente all'indirizzo: ${args.userEmail ?? "(non disponibile)"}</p>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CleanHome <noreply@cleanhome.it>",
      to: SUPPORT_EMAIL,
      reply_to: args.userEmail ?? undefined,
      subject,
      html,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Missing auth token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; chat_id?: string; content?: string; reason?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = body.action ?? "send";

  try {
    // ── Fetch or create active chat ───────────────────────────────
    async function ensureChat(): Promise<string> {
      if (body.chat_id) {
        const { data: existing } = await supabase
          .from("support_chats")
          .select("id, user_id")
          .eq("id", body.chat_id)
          .maybeSingle();
        if (existing && existing.user_id === user.id) return existing.id;
      }
      // Reuse most recent unresolved chat or create new one
      const { data: recent } = await supabase
        .from("support_chats")
        .select("id")
        .eq("user_id", user.id)
        .is("resolved_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent?.id) return recent.id;

      const { data: created, error: createErr } = await supabase
        .from("support_chats")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      if (createErr || !created) throw createErr ?? new Error("Cannot create chat");
      return created.id;
    }

    if (action === "history") {
      const chatId = body.chat_id ?? (await ensureChat());
      const { data: messages } = await supabase
        .from("support_messages")
        .select("id, role, content, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(MAX_HISTORY);
      return json({ chat_id: chatId, messages: messages ?? [] });
    }

    if (action === "escalate") {
      const chatId = body.chat_id;
      if (!chatId) return json({ error: "chat_id required" }, 400);

      const { data: chat } = await supabase
        .from("support_chats")
        .select("id, user_id, escalated_at")
        .eq("id", chatId)
        .maybeSingle();
      if (!chat || chat.user_id !== user.id) {
        return json({ error: "Forbidden" }, 403);
      }
      if (chat.escalated_at) {
        return json({ ok: true, already_escalated: true });
      }

      // Mark escalated
      await supabase
        .from("support_chats")
        .update({ escalated_at: new Date().toISOString() })
        .eq("id", chatId);

      // Append a system note
      await supabase.from("support_messages").insert({
        chat_id: chatId,
        role: "system",
        content: "Conversazione trasferita a un operatore umano. Riceverai una email entro 24h.",
        metadata: { reason: body.reason ?? "user_request" },
      });

      // Build transcript and send email
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const { data: transcript } = await supabase
        .from("support_messages")
        .select("role, content")
        .eq("chat_id", chatId)
        .neq("role", "system")
        .order("created_at", { ascending: true })
        .limit(50);

      await sendEscalationEmail({
        userId: user.id,
        userEmail: user.email ?? null,
        userName: profile?.full_name ?? null,
        chatId,
        reason: body.reason ?? "user_request",
        transcript: (transcript ?? []) as ChatMessage[],
      });

      return json({ ok: true, escalated: true });
    }

    // ── Send (default) ───────────────────────────────────────────
    if (!body.content || typeof body.content !== "string") {
      return json({ error: "content required" }, 400);
    }
    const content = body.content.trim();
    if (content.length === 0) return json({ error: "content empty" }, 400);
    if (content.length > MAX_INPUT_LENGTH) {
      return json({ error: "content too long" }, 400);
    }

    const chatId = await ensureChat();

    // Persist user message
    await supabase.from("support_messages").insert({
      chat_id: chatId,
      role: "user",
      content,
    });

    // Pre-flight escalation: if obvious keyword, suggest escalation in reply
    const escalationHit = detectEscalation(content);

    // Load history (last MAX_HISTORY non-system messages) for Claude
    const { data: prior } = await supabase
      .from("support_messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .neq("role", "system")
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);

    const history: ChatMessage[] = (prior ?? []).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Call Claude
    let reply = await callClaude(history);

    // If escalation keyword, append a structured suggestion
    if (escalationHit) {
      reply +=
        "\n\nSe vuoi, posso passarti subito a un operatore umano: tocca \"Parla con un operatore\" qui sopra.";
    }

    // Persist assistant reply
    await supabase.from("support_messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: reply,
      metadata: escalationHit ? { escalation_hint: escalationHit } : null,
    });

    return json({
      ok: true,
      chat_id: chatId,
      reply,
      escalation_suggested: !!escalationHit,
    });
  } catch (err: any) {
    console.error("[support-chat]", err?.message ?? err);
    return json({ error: "Errore interno del server" }, 500);
  }
});
