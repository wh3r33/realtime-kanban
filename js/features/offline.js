import { badgeClass, mockStores } from "../data/mockStores.js";
import { showToast } from "../ui/toast.js";
import { addActivity, setSyncState } from "./activity.js";

export function renderOfflineQueueItemTemplate(item) {
  return `
    <!-- Future Vue component: OfflineQueueItem -->
    <div class="queue-item" data-component="OfflineQueueItem">
      <span class="status-badge ${badgeClass(item.status)}">${item.status}</span>
      <strong>${item.label}</strong>
    </div>
  `;
}

export function renderOfflineQueue() {
  const queue = document.getElementById("offlineQueue");
  const badge = document.getElementById("connectionBadge");
  const summary = document.querySelector("[data-offline-summary]");
  if (badge) {
    badge.textContent = mockStores.OfflineStore.connection.toUpperCase();
    badge.className = `status-badge ${badgeClass(mockStores.OfflineStore.connection)}`;
  }
  if (summary) {
    summary.textContent = `${mockStores.OfflineStore.pendingQueue.length} local changes waiting. Connection is ${mockStores.OfflineStore.connection}.`;
  }
  if (!queue) return;
  queue.innerHTML = mockStores.OfflineStore.pendingQueue.length
    ? mockStores.OfflineStore.pendingQueue.map(renderOfflineQueueItemTemplate).join("")
    : `<div class="empty-state informative"><strong>Queue clear</strong><span>All local actions have been replayed into the mock realtime channel.</span></div>`;
}

export function initOffline() {
  if (document.body.dataset.page !== "offline") return;
  renderOfflineQueue();
  document.getElementById("simulateOffline")?.addEventListener("click", () => {
    mockStores.OfflineStore.connection = "offline";
    if (!mockStores.OfflineStore.pendingQueue.length) {
      mockStores.OfflineStore.pendingQueue = [{ id: `offline-${Date.now()}`, type: "card_moved", label: "Move Release Notes to Done", status: "queued" }];
    }
    setSyncState("offline", "Offline · local queue active");
    renderOfflineQueue();
    showToast("Offline simulation enabled");
  });
  document.getElementById("retrySync")?.addEventListener("click", () => {
    mockStores.OfflineStore.connection = "reconnecting";
    mockStores.OfflineStore.pendingQueue = mockStores.OfflineStore.pendingQueue.map((item) => ({ ...item, status: "syncing" }));
    setSyncState("reconnecting", "Reconnecting · replaying queue");
    renderOfflineQueue();
    showToast("Retrying sync");
    window.setTimeout(() => {
      mockStores.OfflineStore.connection = "synced";
      mockStores.OfflineStore.pendingQueue = [];
      setSyncState("synced", "Synced · queue replayed");
      addActivity("sync_restored", "Sync restored", "Offline queue was replayed successfully.");
      renderOfflineQueue();
      showToast("Offline queue replayed");
    }, 900);
  });
}
