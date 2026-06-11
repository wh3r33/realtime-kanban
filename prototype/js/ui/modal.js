import { focusFirstInteractive, restoreFocus } from "../core/dom.js";

let lastModalTrigger = null;

export function closeModal() {
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) modalRoot.innerHTML = "";
  restoreFocus(lastModalTrigger);
  lastModalTrigger = null;
}

export function renderModalTemplate(title, body, actions) {
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="modal glass" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
        <button class="icon-button modal-close" data-close-modal type="button" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        <p class="kicker">realtime-kanban</p>
        <h2 id="modalTitle">${title}</h2>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${actions.map((action, index) => `<button class="button ${action.style || "secondary"}" data-modal-action="${index}" type="button">${action.label}</button>`).join("")}
        </div>
      </section>
    </div>
  `;
}

export function openModal(title, body, actions = [{ label: "Done", handler: closeModal, style: "primary" }]) {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  lastModalTrigger = document.activeElement;
  root.innerHTML = renderModalTemplate(title, body, actions);
  root.querySelector("[data-close-modal]")?.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) closeModal();
  });
  root.querySelector(".modal-close")?.addEventListener("click", closeModal);
  actions.forEach((action, index) => {
    root.querySelector(`[data-modal-action="${index}"]`)?.addEventListener("click", () => action.handler?.());
  });
  focusFirstInteractive(root.querySelector(".modal"));
}
