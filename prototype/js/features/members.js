import { mockStores } from "../data/mockStores.js";
import { setCustomSelectOption } from "../ui/dropdown.js";

export function initSettingsLanguage() {
  if (document.body.dataset.page !== "settings") return;
  const select = document.querySelector('[data-select-kind="language"]');
  if (!select) return;
  const option = select.querySelector(`[data-value="${mockStores.SettingsStore.language}"]`) || select.querySelector('[data-value="en"]');
  if (option) setCustomSelectOption(select, option, { silent: true });
}
