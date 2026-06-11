export const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function focusFirstInteractive(container) {
  const target = container?.querySelector(focusableSelector);
  target?.focus();
}

export function restoreFocus(node) {
  if (node && document.contains(node) && typeof node.focus === "function") node.focus();
}

export function trapFocus(event, container) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll(focusableSelector)).filter((node) => !node.hasAttribute("disabled"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function ensureLiveRegion(id = "toastStack") {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    node.className = "toast-stack";
    document.body.appendChild(node);
  }
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-atomic", "false");
  return node;
}
