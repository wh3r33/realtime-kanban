import { focusFirstInteractive, restoreFocus } from "../core/dom.js";

let lastDrawerTrigger = null;

export function openDrawerShell({ title, content, onRendered }) {
  const drawer = document.getElementById("taskDrawer");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerContent = document.getElementById("drawerContent");
  if (!drawer || !drawerTitle || !drawerContent) return false;
  lastDrawerTrigger = document.activeElement;
  drawerTitle.textContent = title;
  drawerContent.innerHTML = content;
  onRendered?.(drawerContent);
  drawer.classList.add("open");
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-hidden", "false");
  if (!drawer.getAttribute("aria-labelledby")) drawer.setAttribute("aria-labelledby", "drawerTitle");
  focusFirstInteractive(drawer);
  return true;
}

export function closeDrawer() {
  const drawer = document.getElementById("taskDrawer");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  restoreFocus(lastDrawerTrigger);
  lastDrawerTrigger = null;
}

export function initDrawer() {
  document.getElementById("closeDrawer")?.addEventListener("click", closeDrawer);
}
