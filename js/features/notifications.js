import { badgeClass, mockStores } from "../data/mockStores.js";

export function renderNotificationTemplate(notification) {
  return `
    <!-- Future Vue component: NotificationItem -->
    <article class="notification ${notification.unread ? "unread" : ""} ${notification.type.includes("conflict") ? "conflict" : ""}" data-notification="${notification.id}" data-component="NotificationItem" role="button" tabindex="0" aria-label="Toggle notification: ${notification.title}">
      <strong>${notification.title}</strong>
      <p>${notification.body}</p>
      <time>${notification.createdAt}</time>
    </article>
  `;
}

export function renderNotifications() {
  const list = document.querySelector("[data-notification-list]");
  if (!list) return;
  list.innerHTML = mockStores.NotificationStore.notifications.map(renderNotificationTemplate).join("");
  initNotifications();
}

export function initNotifications() {
  document.querySelectorAll("[data-notification]").forEach((item) => {
    const toggleNotification = () => {
      const note = mockStores.NotificationStore.notifications.find((entry) => entry.id === item.dataset.notification);
      if (note) note.unread = !note.unread;
      item.classList.toggle("unread");
      item.setAttribute("aria-pressed", String(item.classList.contains("unread")));
    };
    item.setAttribute("aria-pressed", String(item.classList.contains("unread")));
    item.addEventListener("click", toggleNotification);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleNotification();
      }
    });
  });
}
