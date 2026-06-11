import { supabase } from "./supabaseClient";

async function invokeAiAssistant(body) {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const { data, error } = await supabase.functions.invoke("ai-assistant", { body });
  if (error) throw new Error(error.message || "AI assistant function request failed.");
  if (data?.error) throw new Error(data.error);
  if (!Array.isArray(data?.items)) throw new Error("AI assistant returned an invalid response.");

  return data.items.map((item) => String(item).trim()).filter(Boolean);
}

export function generateAiSubtasks({ prompt, card }) {
  return invokeAiAssistant({
    mode: "subtasks",
    prompt,
    card
  });
}

export function prioritizeBoardCards({ prompt, cards }) {
  return invokeAiAssistant({
    mode: "priority",
    prompt,
    cards
  });
}
