import { ensureLiveRegion } from "../core/dom.js";

export function renderToastTemplate(message, actions = []) {
  return `
    <span>${message}</span>
    ${actions.map((action) => `<button type="button" data-toast-action="${action.id}">${action.label}</button>`).join("")}
  `;
}

export function showToast(message, actions = []) {
  const toastStack = ensureLiveRegion();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = renderToastTemplate(message, actions);
  toastStack.appendChild(toast);
  actions.forEach((action) => {
    toast.querySelector(`[data-toast-action="${action.id}"]`)?.addEventListener("click", () => {
      action.handler?.();
      toast.remove();
    });
  });
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    window.setTimeout(() => toast.remove(), 240);
  }, 4600);
}
