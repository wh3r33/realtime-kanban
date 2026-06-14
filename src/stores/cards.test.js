import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";
import { useBoardsStore } from "./boards";
import { useCardsStore } from "./cards";

const mocks = vi.hoisted(() => ({
  moveCard: vi.fn(),
  undoLastBoardAction: vi.fn()
}));

vi.mock("../services/cardRepository", () => ({
  createCard: vi.fn(),
  deleteCard: vi.fn(),
  moveCard: (...args) => mocks.moveCard(...args),
  restoreCard: vi.fn(),
  undoLastBoardAction: (...args) => mocks.undoLastBoardAction(...args),
  updateCard: vi.fn()
}));

vi.mock("../services/activityRepository", () => ({
  listBoardActivity: vi.fn(async () => ({ data: [], error: null })),
  createActivityLog: vi.fn(async () => ({ data: null, error: null }))
}));

vi.mock("../services/realtimeService", () => ({
  subscribeToBoard: vi.fn(() => ({
    mode: "broadcast",
    publish: vi.fn(),
    track: vi.fn(),
    untrack: vi.fn(),
    unsubscribe: vi.fn()
  }))
}));

function card(overrides = {}) {
  return {
    id: "card-1",
    boardId: "board-1",
    columnId: "col-1",
    column: "Todo",
    title: "Card",
    description: "",
    assigneeId: null,
    position: 0,
    status: "active",
    labels: [],
    version: 1,
    ...overrides
  };
}

function cardRow(overrides = {}) {
  return {
    id: "card-1",
    board_id: "board-1",
    column_id: "col-1",
    title: "Card",
    description: "",
    assigned_to: null,
    created_by: "user-1",
    position: 0,
    status: "active",
    labels: [],
    version: 1,
    created_at: "2026-06-12T00:00:00.000Z",
    updated_at: "2026-06-12T00:00:00.000Z",
    ...overrides
  };
}

describe("cards store movement and undo", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.moveCard.mockReset();
    mocks.undoLastBoardAction.mockReset();

    const auth = useAuthStore();
    auth.setBoardRole("editor");

    const boards = useBoardsStore();
    boards.selectedBoardId = "board-1";
    boards.columns = [
      { id: "col-1", boardId: "board-1", title: "Todo", position: 0 },
      { id: "col-2", boardId: "board-1", title: "Done", position: 1 }
    ];
  });

  it("persists card movement through the repository and records undo history", async () => {
    const cards = useCardsStore();
    cards.cards = [card()];
    mocks.moveCard.mockResolvedValueOnce({ data: card({ columnId: "col-2", column: "Done", position: 0, version: 2 }), error: null });

    const result = await cards.moveTask("card-1", "col-2", 0);

    expect(mocks.moveCard).toHaveBeenCalledWith("card-1", "col-2", 0, 1);
    expect(result.to).toBe("Done");
    expect(cards.cardById("card-1").columnId).toBe("col-2");
    expect(cards.undoHistory).toHaveLength(1);
  });

  it("undoes through the backend undo RPC", async () => {
    const cards = useCardsStore();
    cards.cards = [card()];
    cards.loadCards = vi.fn(async () => {});
    mocks.moveCard.mockResolvedValueOnce({ data: card({ columnId: "col-2", column: "Done", position: 0, version: 2 }), error: null });
    mocks.undoLastBoardAction.mockResolvedValueOnce({ data: { status: "ok", undone_action: "card_moved", entity_id: "card-1" }, error: null });

    await cards.moveTask("card-1", "col-2", 0);
    const action = await cards.undoLastAction();

    expect(action.undone_action).toBe("card_moved");
    expect(mocks.undoLastBoardAction).toHaveBeenCalledWith("board-1");
    expect(cards.loadCards).toHaveBeenCalledWith("board-1");
    expect(cards.undoHistory).toHaveLength(0);
    expect(cards.redoHistory).toHaveLength(0);
  });
});

describe("cards store realtime board synchronization", () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    const boards = useBoardsStore();
    boards.selectedBoardId = "board-1";
    boards.columns = [
      { id: "col-1", boardId: "board-1", title: "Todo", position: 0 },
      { id: "col-2", boardId: "board-1", title: "Done", position: 1 }
    ];
  });

  it("applies realtime card inserts and updates to board state", () => {
    const cards = useCardsStore();

    cards.applyCardChange({ eventType: "INSERT", new: cardRow({ title: "Realtime card" }) });
    expect(cards.cardById("card-1")).toMatchObject({ title: "Realtime card", columnId: "col-1", column: "Todo" });

    cards.applyCardChange({
      eventType: "UPDATE",
      new: cardRow({ title: "Moved remotely", column_id: "col-2", position: 3, version: 2 })
    });

    expect(cards.cardById("card-1")).toMatchObject({ title: "Moved remotely", columnId: "col-2", column: "Done", position: 3, version: 2 });
    expect(cards.cardsForColumn("board-1", "col-1")).toHaveLength(0);
    expect(cards.cardsForColumn("board-1", "col-2")).toHaveLength(1);
  });

  it("keeps repeated realtime updates idempotent without duplicate cards", () => {
    const cards = useCardsStore();
    cards.cards = [card({ id: "card-1" })];
    const movedPayload = {
      eventType: "UPDATE",
      new: cardRow({ id: "card-1", column_id: "col-2", position: 2, version: 2 })
    };

    cards.applyCardChange(movedPayload);
    cards.applyCardChange(movedPayload);

    expect(cards.cards.filter((item) => item.id === "card-1")).toHaveLength(1);
    expect(cards.cardsForColumn("board-1", "col-1")).toHaveLength(0);
    expect(cards.cardsForColumn("board-1", "col-2")).toHaveLength(1);
    expect(cards.cardById("card-1")).toMatchObject({ columnId: "col-2", position: 2, version: 2 });
  });

  it("removes cards for realtime deletes and soft deletes", () => {
    const cards = useCardsStore();
    cards.cards = [card()];

    cards.applyCardChange({ eventType: "UPDATE", new: cardRow({ status: "deleted", version: 2 }) });
    expect(cards.cardById("card-1")).toBeUndefined();

    cards.cards = [card()];
    cards.applyCardChange({ eventType: "DELETE", old: cardRow() });
    expect(cards.cardById("card-1")).toBeUndefined();
  });

  it("uses activity log payloads as a board-surface fallback when direct card events are absent", () => {
    const cards = useCardsStore();
    cards.realtime.boardId = "board-1";
    cards.loadCards = vi.fn(async () => {});

    cards.applyBoardSurfaceActivityChange({
      new: {
        board_id: "board-1",
        action: "card_moved",
        entity_type: "card",
        entity_id: "card-1",
        new_data: cardRow({ column_id: "col-2", position: 1, title: "Moved through activity" })
      }
    });

    expect(cards.cardById("card-1")).toMatchObject({ title: "Moved through activity", columnId: "col-2", column: "Done", position: 1 });
    expect(cards.loadCards).toHaveBeenCalledWith("board-1");

    cards.applyBoardSurfaceActivityChange({
      new: {
        board_id: "board-1",
        action: "card_deleted",
        entity_type: "card",
        entity_id: "card-1",
        old_data: cardRow({ column_id: "col-2" }),
        new_data: cardRow({ column_id: "col-2", status: "deleted" })
      }
    });

    expect(cards.cardById("card-1")).toBeUndefined();
  });
});
