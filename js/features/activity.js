import { badgeClass, cardById, currentUser, mockStores, nowLabel, userById } from "../data/mockStores.js";

const typeMap = {
  card_moved: "cards",
  card_edited: "cards",
  card_created: "cards",
  comment_added: "cards",
  comment_deleted: "cards",
  invite_sent: "members",
  invite_accepted: "members",
  invite_revoked: "members",
  member_role_changed: "members",
  conflict_detected: "conflicts",
  conflict_resolved: "conflicts",
  sync_restored: "system"
};

export function renderActivityItemTemplate(event, index = 0) {
  return `
    <!-- Future Vue component: ActivityItem -->
    <div class="activity-item ${index === 0 ? "new" : ""}" data-component="ActivityItem">
      <strong>${event.title}</strong>
      <span>${event.body}</span>
      <time>${event.createdAt}</time>
    </div>
  `;
}

export function renderTimelineItemTemplate(event) {
  const actor = userById(event.actorId);
  return `
    <!-- Future Vue component: ActivityTimelineItem -->
    <article data-type="${typeMap[event.type] || "system"}" data-component="ActivityTimelineItem">
      <span class="tiny-avatar" style="--ring:${actor.color}">${actor.initials}</span>
      <div><strong>${event.title}</strong><p>${event.body}</p><time>${event.createdAt}</time></div>
    </article>
  `;
}

export function renderActivity() {
  const activityFeed = document.getElementById("activityFeed");
  const editingNow = document.getElementById("editingNow");
  if (!activityFeed || !editingNow) return;
  activityFeed.innerHTML = mockStores.ActivityStore.events.slice(0, 6).map(renderActivityItemTemplate).join("");
  editingNow.innerHTML = mockStores.PresenceStore.editingUsers
    .slice(0, 4)
    .map((presence) => {
      const user = userById(presence.userId);
      const task = cardById(presence.cardId);
      return `
        <div class="editing-item" data-component="EditingPresenceItem">
          <strong>${user.name}</strong>
          <span>${presence.mode === "viewing" ? "Viewing" : "Editing"} ${task?.title || "board"} · ${presence.duration}</span>
        </div>
      `;
    })
    .join("");
}

export function renderActivityPage() {
  const timeline = document.querySelector("[data-activity-timeline]");
  if (!timeline) return;
  timeline.innerHTML = mockStores.ActivityStore.events.map(renderTimelineItemTemplate).join("");
}

export function addActivity(type, title, body, actorId = mockStores.AuthStore.currentUserId) {
  mockStores.ActivityStore.events.unshift({
    id: `evt-${Date.now()}`,
    type,
    actorId,
    title,
    body,
    createdAt: nowLabel()
  });
  mockStores.ActivityStore.events = mockStores.ActivityStore.events.slice(0, 20);
  const lastChanged = document.getElementById("lastChanged");
  if (lastChanged) lastChanged.textContent = `Last change ${nowLabel()}`;
  renderActivity();
  renderActivityPage();
}

export function initFilters() {
  const group = document.querySelector("[data-filter-group]");
  if (!group) return;
  renderActivityPage();
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const filter = button.dataset.filter;
    document.querySelectorAll(".timeline article").forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.type !== filter;
    });
  });
}

export function setSyncState(state, detail) {
  mockStores.PresenceStore.syncState = state;
  document.querySelectorAll("[data-sync-text]").forEach((node) => {
    node.textContent = detail || `${state.charAt(0).toUpperCase()}${state.slice(1)} · ${nowLabel()}`;
  });
  document.querySelectorAll("[data-live-status], [data-sync-state]").forEach((node) => {
    node.textContent = state.toUpperCase();
    node.className = `status-badge ${badgeClass(state)}`;
  });
}

export function initRealtimeStatus() {
  setSyncState(mockStores.PresenceStore.syncState, "Synced · heartbeat just now");
  const feed = document.querySelector("[data-realtime-feed]");
  if (feed) {
    feed.innerHTML = mockStores.PresenceStore.editingUsers.map((presence) => {
      const user = userById(presence.userId);
      const task = cardById(presence.cardId);
      return `<span>${user.name} ${presence.mode} ${task?.title || "board"}</span>`;
    }).join("");
  }
  window.setInterval(() => {
    setSyncState("synced", `Synced · heartbeat ${Math.floor(Math.random() * 4) + 1}s ago`);
  }, 4200);
}

export function initRoleToggles({ showToast }) {
  const roleOrder = ["viewer", "editor"];
  document.querySelectorAll("[data-role-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = roleOrder.find((role) => button.classList.contains(role)) || "viewer";
      const next = roleOrder[(roleOrder.indexOf(current) + 1) % roleOrder.length];
      roleOrder.forEach((role) => button.classList.remove(role));
      button.classList.add(next);
      button.textContent = next.toUpperCase();
      addActivity("member_role_changed", "Role changed", `${currentUser().name} changed a member role to ${next}.`);
      showToast(`Mock role changed to ${next.toUpperCase()}`);
    });
  });
}
