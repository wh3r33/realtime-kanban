import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";
import { useBoardsStore } from "./boards";
import { useCardsStore } from "./cards";

const mocks = vi.hoisted(() => ({
  moveCard: vi.fn()
}));

vi.mock("../services/cardRepository", () => ({
  createCard: vi.fn(),
  deleteCard: vi.fn(),
  moveCard: (...args) => mocks.moveCard(...args),
  restoreCard: vi.fn(),
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

describe("cards store movement and undo", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.moveCard.mockReset();

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

  it("undoes a move with a real inverse repository call", async () => {
    const cards = useCardsStore();
    cards.cards = [card()];
    mocks.moveCard
      .mockResolvedValueOnce({ data: card({ columnId: "col-2", column: "Done", position: 0, version: 2 }), error: null })
      .mockResolvedValueOnce({ data: card({ columnId: "col-1", column: "Todo", position: 0, version: 3 }), error: null });

    await cards.moveTask("card-1", "col-2", 0);
    const action = await cards.undoLastAction();

    expect(action.type).toBe("move");
    expect(mocks.moveCard).toHaveBeenLastCalledWith("card-1", "col-1", 0, 2);
    expect(cards.cardById("card-1").columnId).toBe("col-1");
    expect(cards.undoHistory).toHaveLength(0);
    expect(cards.redoHistory).toHaveLength(1);
  });
});
