import { badgeClass, boardById, mockStores, userById } from "../data/mockStores.js";

export function renderSearchResultTemplate(result) {
  return `
    <!-- Future Vue component: SearchResultCard -->
    <article class="result-card" data-component="SearchResultCard">
      <span class="status-badge ${badgeClass(result.kind === "TASK" ? result.status : result.kind)}">${result.kind}</span>
      <h2>${result.title}</h2>
      <p>${result.body}</p>
    </article>
  `;
}

export function renderSearchResults() {
  const root = document.getElementById("searchResults");
  const input = document.getElementById("searchInput");
  if (!root || !input) return;
  const query = input.value.trim().toLowerCase();
  const boardFilter = document.querySelector("[data-search-board]")?.value || "any";
  const statusFilter = document.querySelector("[data-search-status]")?.value || "any";
  const memberFilter = document.querySelector("[data-search-member]")?.value || "any";
  const labelFilter = document.querySelector("[data-search-label]")?.value || "any";

  const taskResults = mockStores.TaskStore.cards.map((card) => {
    const boardItem = boardById(card.boardId);
    const user = userById(card.assigneeId);
    return {
      kind: "TASK",
      title: card.title,
      body: `${card.column} on ${boardItem?.name || "Workspace"}, assigned to ${user.name}.`,
      board: card.boardId,
      status: card.status,
      member: card.assigneeId,
      labels: card.labels.map(badgeClass),
      haystack: `${card.title} ${card.description} ${card.column} ${boardItem?.name} ${user.name} ${card.status} ${card.labels.join(" ")}`.toLowerCase()
    };
  });
  const boardResults = mockStores.BoardStore.boards.map((boardItem) => ({
    kind: "BOARD",
    title: boardItem.name,
    body: `${boardItem.cards} cards, ${boardItem.online} online collaborators.`,
    board: boardItem.id,
    status: "live",
    member: "any",
    labels: ["online"],
    haystack: `${boardItem.name} ${boardItem.summary} board online`.toLowerCase()
  }));
  const memberResults = mockStores.PresenceStore.users.map((user) => ({
    kind: "USER",
    title: user.name,
    body: `${user.role} · ${user.presence} · ${user.activity}.`,
    board: "any",
    status: user.presence,
    member: user.id,
    labels: [user.role, user.presence],
    haystack: `${user.name} ${user.email} ${user.role} ${user.presence} ${user.activity}`.toLowerCase()
  }));

  const results = [...taskResults, ...boardResults, ...memberResults].filter((item) => {
    const matchesQuery = !query || item.haystack.includes(query);
    const matchesBoard = boardFilter === "any" || item.board === boardFilter;
    const matchesStatus = statusFilter === "any" || item.status === statusFilter;
    const matchesMember = memberFilter === "any" || item.member === memberFilter;
    const matchesLabel = labelFilter === "any" || item.labels.includes(labelFilter);
    return matchesQuery && matchesBoard && matchesStatus && matchesMember && matchesLabel;
  });

  root.innerHTML = results.length
    ? results.map(renderSearchResultTemplate).join("")
    : `<div class="empty-state informative"><strong>No results match</strong><span>Clear a filter or search for a card title, board, member, or status.</span></div>`;
}

export function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", renderSearchResults);
  document.querySelectorAll("[data-search-board], [data-search-status], [data-search-member], [data-search-label]").forEach((select) => {
    select.addEventListener("change", renderSearchResults);
  });
  renderSearchResults();
}
