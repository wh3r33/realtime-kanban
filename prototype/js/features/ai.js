import { showToast } from "../ui/toast.js";

export function renderAiChecklistTemplate() {
  return "<li>Confirm realtime payload shape</li><li>Add rollback checkpoint</li><li>Write card movement tests</li><li>Request editor review</li>";
}

export function initAiAssistant() {
  const output = document.getElementById("aiOutput");
  document.getElementById("generateAi")?.addEventListener("click", () => {
    if (output) output.innerHTML = renderAiChecklistTemplate();
    showToast("AI checklist generated");
  });
  document.querySelectorAll("[data-ai-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-ai-mode]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });
}
