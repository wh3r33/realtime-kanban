import { badgeClass, cardById, commentsFor, currentUser, mockStores, nowLabel, userById } from "../data/mockStores.js";
import { addActivity } from "./activity.js";

let commentDraftCounter = 10;

export function renderCommentsTemplate(cardId) {
  const comments = commentsFor(cardId);
  if (!comments.length) {
    return `<div class="empty-state informative compact"><strong>No comments yet</strong><span>Add a note for teammates reviewing this card.</span></div>`;
  }
  return comments
    .map((comment) => {
      const author = userById(comment.authorId);
      return `
        <!-- Future Vue component: CommentItem -->
        <div class="comment" data-component="CommentItem" data-comment-id="${comment.id}">
          <span class="tiny-avatar" style="--ring:${author.color}">${author.initials}</span>
          <p>${comment.body}<small>${author.name} · ${comment.createdAt}</small></p>
          <button class="icon-button small" type="button" data-delete-comment="${comment.id}" aria-label="Delete comment">×</button>
        </div>
      `;
    })
    .join("");
}

export function renderTaskDrawerTemplate(task) {
  const assignee = userById(task.assigneeId);
  const editor = mockStores.PresenceStore.editingUsers.find((item) => item.cardId === task.id);
  const lock = mockStores.PresenceStore.locks.find((item) => item.cardId === task.id);
  return `
    <!-- Future Vue component: TaskDrawer -->
    <div class="drawer-block">
      <div class="card-badges">
        ${task.labels.map((badge) => `<span class="status-badge ${badgeClass(badge)}">${badge}</span>`).join("")}
      </div>
      <p>${task.description}</p>
    </div>
    <div class="drawer-block">
      <h4>Collaboration State</h4>
      <div class="drawer-row"><span>Status</span><strong>${task.status.toUpperCase()}</strong></div>
      <div class="drawer-row"><span>Assigned User</span><strong>${assignee.name}</strong></div>
      <div class="drawer-row"><span>Column</span><strong>${task.column}</strong></div>
      ${editor ? `<div class="drawer-row"><span>Editing</span><strong>${userById(editor.userId).name} · ${editor.duration}</strong></div>` : ""}
      ${lock ? `<div class="drawer-row"><span>Lock</span><strong>${userById(lock.userId).name} · ${lock.reason}</strong></div>` : ""}
    </div>
    <div class="drawer-block">
      <h4>Activity History</h4>
      ${task.history.map((item) => `<p>${item}</p>`).join("")}
    </div>
    <div class="drawer-block" data-component="CommentList">
      <h4>Comments</h4>
      <div class="comment-list" data-comment-list>
        ${renderCommentsTemplate(task.id)}
      </div>
      <form class="comment-form" data-comment-form>
        <label class="sr-only" for="commentDraft">Add comment</label>
        <textarea class="input textarea compact-textarea" id="commentDraft" data-comment-input placeholder="Add a local mock comment"></textarea>
        <button class="button primary" type="submit">Add comment</button>
      </form>
    </div>
  `;
}

export function bindDrawerCommentEvents(cardId, drawerContent, { openDrawer, showToast }) {
  drawerContent.querySelector("[data-comment-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = drawerContent.querySelector("[data-comment-input]");
    const body = input.value.trim();
    if (!body) {
      showToast("Write a comment before adding it");
      return;
    }
    mockStores.TaskStore.comments.unshift({
      id: `comment-${commentDraftCounter++}`,
      cardId,
      authorId: mockStores.AuthStore.currentUserId,
      body,
      createdAt: nowLabel()
    });
    cardById(cardId).history.unshift(`${currentUser().name} commented ${nowLabel()}`);
    addActivity("comment_added", "Comment added", `${currentUser().name} commented on ${cardById(cardId).title}.`);
    input.value = "";
    openDrawer(cardId);
    showToast("Comment added locally");
  });

  drawerContent.querySelectorAll("[data-delete-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      mockStores.TaskStore.comments = mockStores.TaskStore.comments.filter((comment) => comment.id !== button.dataset.deleteComment);
      addActivity("comment_deleted", "Comment deleted", `${currentUser().name} deleted a comment on ${cardById(cardId).title}.`);
      openDrawer(cardId);
      showToast("Comment deleted");
    });
  });
}
