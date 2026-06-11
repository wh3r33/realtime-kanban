const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type AiMode = "subtasks" | "priority";

type RequestBody = {
  mode?: AiMode;
  prompt?: string;
  card?: {
    title?: string;
    description?: string;
  };
  cards?: Array<{
    id?: string;
    title?: string;
    description?: string;
    column?: string;
    status?: string;
    position?: number;
  }>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function cleanJsonContent(content: string) {
  return content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseItems(content: string) {
  try {
    const parsed = JSON.parse(cleanJsonContent(content));
    if (!Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .filter((item: unknown) => typeof item === "string")
      .map((item: string) => item.trim())
      .filter(Boolean);

    return items.length ? items : null;
  } catch {
    return null;
  }
}

function buildMessages(body: RequestBody) {
  const prompt = body.prompt?.trim() || "Generate helpful kanban recommendations.";

  if (body.mode === "subtasks") {
    const card = {
      title: body.card?.title || "Untitled card",
      description: body.card?.description || ""
    };

    return [
      {
        role: "system",
        content:
          'You are a kanban planning assistant. Return ONLY valid JSON in this exact shape: {"items":["string","string"]}. Do not include markdown or commentary.'
      },
      {
        role: "user",
        content: `Create concise implementation checklist items for this card.\nPrompt: ${prompt}\nCard title: ${card.title}\nCard description: ${card.description}`
      }
    ];
  }

  const cards = (body.cards || []).map((card, index) => ({
    id: card.id,
    title: card.title || `Card ${index + 1}`,
    description: card.description || "",
    column: card.column || card.status || "",
    position: card.position ?? index
  }));

  return [
    {
      role: "system",
      content:
        'You are a kanban prioritization assistant. Return ONLY valid JSON in this exact shape: {"items":["1. Card title — reason","2. Card title — reason"]}. Do not include markdown or commentary.'
    },
    {
      role: "user",
      content: `Recommend priority order for these cards without changing data.\nPrompt: ${prompt}\nCards: ${JSON.stringify(cards)}`
    }
  ];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "DeepSeek API key is not configured." }, 500);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  if (body.mode !== "subtasks" && body.mode !== "priority") {
    return jsonResponse({ error: "Invalid AI mode." }, 400);
  }

  try {
    const deepSeekResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: buildMessages(body),
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!deepSeekResponse.ok) {
      return jsonResponse({ error: "AI provider request failed." }, 502);
    }

    const payload = await deepSeekResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return jsonResponse({ error: "AI provider returned an invalid response." }, 502);
    }

    const items = parseItems(content);
    if (!items) {
      return jsonResponse({ error: "AI response could not be parsed." }, 502);
    }

    return jsonResponse({ items });
  } catch {
    return jsonResponse({ error: "AI assistant request failed." }, 500);
  }
});
