import { restoreFocus } from "../core/dom.js";
import { mockStores } from "../data/mockStores.js";
import { showToast } from "./toast.js";

let lastSelectTrigger = null;

export function closeCustomSelect(select) {
  const trigger = select.querySelector("[data-custom-select-trigger]");
  select.classList.remove("open");
  trigger?.setAttribute("aria-expanded", "false");
}

export function closeCustomSelectAndRestore(select) {
  closeCustomSelect(select);
  restoreFocus(lastSelectTrigger || select.querySelector("[data-custom-select-trigger]"));
  lastSelectTrigger = null;
}

export function closeAllDropdowns() {
  document.querySelectorAll("[data-custom-select].open").forEach((select) => closeCustomSelectAndRestore(select));
}

export function openCustomSelect(select) {
  const trigger = select.querySelector("[data-custom-select-trigger]");
  document.querySelectorAll("[data-custom-select].open").forEach((item) => {
    if (item !== select) closeCustomSelect(item);
  });
  lastSelectTrigger = trigger;
  select.classList.add("open");
  trigger?.setAttribute("aria-expanded", "true");
}

export function setCustomSelectOption(select, option, config = {}) {
  const valueInput = select.querySelector("[data-custom-select-value]");
  const title = select.querySelector("[data-custom-select-title]");
  const description = select.querySelector("[data-custom-select-description]");
  const options = Array.from(select.querySelectorAll("[data-custom-select-menu] [data-value]"));
  const nextValue = option.dataset.value || "";

  if (valueInput) valueInput.value = nextValue;
  if (title) title.textContent = option.dataset.title || option.textContent.trim();
  if (description) description.textContent = option.dataset.description || "";

  options.forEach((item) => {
    const isActive = item === option;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("role", "option");
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  closeCustomSelect(select);
  if (config.silent) return;

  if (select.dataset.selectKind === "language") {
    mockStores.SettingsStore.language = nextValue;
    localStorage.setItem("rk_language", nextValue);
    showToast(nextValue === "ru" ? "Язык изменён на русский" : "Language changed to English");
    return;
  }

  mockStores.SettingsStore.conflictStrategy = nextValue;
  showToast(`Conflict strategy set to ${option.dataset.title}`);
}

export function initCustomSelects() {
  document.querySelectorAll("[data-custom-select]").forEach((select) => {
    const trigger = select.querySelector("[data-custom-select-trigger]");
    const menu = select.querySelector("[data-custom-select-menu]");
    const options = Array.from(select.querySelectorAll("[data-custom-select-menu] [data-value]"));
    if (!trigger || !options.length) return;
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    menu?.setAttribute("role", "listbox");
    if (!trigger.getAttribute("aria-label")) {
      trigger.setAttribute("aria-label", trigger.textContent.trim().replace(/\s+/g, " "));
    }

    trigger.addEventListener("click", () => {
      if (select.classList.contains("open")) closeCustomSelect(select);
      else openCustomSelect(select);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCustomSelect(select);
        options.find((option) => option.classList.contains("active"))?.focus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomSelect(select);
      }
    });

    options.forEach((option, index) => {
      option.addEventListener("click", () => setCustomSelectOption(select, option));
      option.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setCustomSelectOption(select, option);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          options[(index + 1) % options.length].focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          options[(index - 1 + options.length) % options.length].focus();
        }
        if (event.key === "Home") {
          event.preventDefault();
          options[0].focus();
        }
        if (event.key === "End") {
          event.preventDefault();
          options[options.length - 1].focus();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeCustomSelectAndRestore(select);
        }
      });
    });
  });

  document.addEventListener("click", (event) => {
    document.querySelectorAll("[data-custom-select].open").forEach((select) => {
      if (!select.contains(event.target)) closeCustomSelect(select);
    });
  });
}
