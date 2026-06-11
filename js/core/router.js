import { boardById, mockStores, selectedBoard } from "../data/mockStores.js";

const boardRouteFiles = {
  board: "board.html",
  activity: "activity.html",
  members: "members.html",
  settings: "settings.html"
};

export function getBoardId() {
  const requestedBoardId = new URLSearchParams(window.location.search).get("boardId");
  return boardById(requestedBoardId)?.id || mockStores.BoardStore.boards[0]?.id || "board-main";
}

export function getCurrentRoute() {
  const body = document.body;
  return {
    page: body?.dataset.page || "",
    route: body?.dataset.route || window.location.pathname,
    path: window.location.pathname,
    params: { boardId: getBoardId() },
    query: Object.fromEntries(new URLSearchParams(window.location.search))
  };
}

export function boardScopedHref(fileName, boardId = mockStores.BoardStore.selectedBoardId) {
  return `${fileName}?boardId=${encodeURIComponent(boardId)}`;
}

export function initSelectedBoard() {
  if (["board", "activity", "members", "settings"].includes(document.body.dataset.page)) {
    mockStores.BoardStore.selectedBoardId = getBoardId();
  }
}

export function syncBoardRouteLinks() {
  const id = mockStores.BoardStore.selectedBoardId || getBoardId();
  document.querySelectorAll("[data-board-route]").forEach((link) => {
    const fileName = boardRouteFiles[link.dataset.boardRoute];
    if (fileName) link.setAttribute("href", boardScopedHref(fileName, id));
  });
}

export function renderSelectedBoardMeta() {
  const currentBoard = selectedBoard();
  document.querySelectorAll("[data-selected-board-label]").forEach((node) => {
    node.textContent = currentBoard.name;
  });
  document.querySelectorAll("[data-selected-board-title]").forEach((node) => {
    node.textContent = currentBoard.name;
  });
  document.querySelectorAll("[data-selected-board-summary]").forEach((node) => {
    node.textContent = currentBoard.summary;
  });
}

export function readRouteMetadata() {
  return Array.from(document.querySelectorAll("[data-route]")).map((node) => ({
    tag: node.tagName.toLowerCase(),
    page: node.dataset.page || "",
    route: node.dataset.route || ""
  }));
}

// Vue Router mapping: data-route="/boards/:boardId" becomes a route record path,
// while the current static prototype maps :boardId through ?boardId until migration.
