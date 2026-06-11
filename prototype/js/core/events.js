import { trapFocus } from "./dom.js";

export function initGlobalEvents({ closeDrawer, closeModal, closeDropdowns }) {
  document.addEventListener("keydown", (event) => {
    const activeModal = document.querySelector(".modal");
    const activeDrawer = document.querySelector(".task-drawer.open");
    if (activeModal) trapFocus(event, activeModal);
    else if (activeDrawer) trapFocus(event, activeDrawer);

    if (event.key === "Escape") {
      closeDrawer?.();
      closeModal?.();
      closeDropdowns?.();
    }
  });
}
