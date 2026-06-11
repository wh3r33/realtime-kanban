import { currentUser, mockStores, nowLabel } from "../data/mockStores.js";
import { closeModal, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { addActivity } from "./activity.js";

export function renderInviteTemplate(invite) {
  return `
    <!-- Future Vue component: InviteRow -->
    <article class="invite-row" data-component="InviteRow" data-invite-id="${invite.id}">
      <div>
        <strong>${invite.email}</strong>
        <span>${invite.role.toUpperCase()} · ${invite.status} · ${invite.createdAt}</span>
      </div>
      <div class="inline-actions">
        ${invite.status === "pending" ? `<button class="button secondary" type="button" data-accept-invite="${invite.id}">Accept</button>` : ""}
        <button class="button secondary" type="button" data-revoke-invite="${invite.id}">Revoke</button>
      </div>
    </article>
  `;
}

export function openInviteModal() {
  const body = `
    <form class="modal-form" data-invite-form>
      <label>Email<input class="input" name="email" type="email" value="new.member@example.com" required /></label>
      <label>Role
        <select class="input" name="role">
          <option value="viewer">Viewer</option>
          <option value="editor" selected>Editor</option>
        </select>
      </label>
    </form>
  `;
  openModal("Invite member", body, [
    { label: "Cancel", handler: closeModal, style: "secondary" },
    {
      label: "Create invite",
      style: "primary",
      handler: () => {
        const form = document.querySelector("[data-invite-form]");
        const formData = new FormData(form);
        createInvite(formData.get("email"), formData.get("role"));
        closeModal();
      }
    }
  ]);
}

export function createInvite(email, role) {
  if (!email) {
    showToast("Invite requires an email");
    return;
  }
  mockStores.InvitationStore.invites.unshift({
    id: `invite-${Date.now()}`,
    email,
    role,
    status: "pending",
    invitedBy: currentUser().name,
    createdAt: nowLabel()
  });
  addActivity("invite_sent", "Invite sent", `${currentUser().name} invited ${email} as ${role}.`);
  renderInvites();
  showToast(`Invite created for ${email}`);
}

export function acceptInvite(inviteId) {
  const invite = mockStores.InvitationStore.invites.find((item) => item.id === inviteId) || mockStores.InvitationStore.invites[0];
  if (!invite) return;
  invite.status = "accepted";
  mockStores.AuthStore.invitation.status = "accepted";
  addActivity("invite_accepted", "Invite accepted", `${invite.email} accepted ${invite.role} access.`);
  renderInvites();
  showToast("Invitation accepted");
}

export function revokeInvite(inviteId) {
  const invite = mockStores.InvitationStore.invites.find((item) => item.id === inviteId);
  mockStores.InvitationStore.invites = mockStores.InvitationStore.invites.filter((item) => item.id !== inviteId);
  addActivity("invite_revoked", "Invite revoked", `${currentUser().name} revoked invite for ${invite?.email || "member"}.`);
  renderInvites();
  showToast("Invite revoked");
}

export function renderInvites() {
  document.querySelectorAll("[data-invite-list]").forEach((container) => {
    const invites = mockStores.InvitationStore.invites;
    container.innerHTML = invites.length
      ? invites.map(renderInviteTemplate).join("")
      : `<div class="empty-state informative compact"><strong>No pending invites</strong><span>Create one when a teammate needs board access.</span></div>`;
  });
  document.querySelectorAll("[data-accept-invite]").forEach((button) => button.addEventListener("click", () => acceptInvite(button.dataset.acceptInvite)));
  document.querySelectorAll("[data-revoke-invite]").forEach((button) => button.addEventListener("click", () => revokeInvite(button.dataset.revokeInvite)));
}

export function initInvites() {
  document.querySelectorAll("[data-open-invite]").forEach((button) => button.addEventListener("click", openInviteModal));
  document.querySelector("[data-accept-invitation]")?.addEventListener("click", (event) => {
    event.preventDefault();
    acceptInvite("invite-01");
    window.setTimeout(() => {
      window.location.href = "../workspace/board.html";
    }, 500);
  });
  renderInvites();
}
