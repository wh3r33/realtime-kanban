import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: null,
  getCurrentUser: vi.fn(),
  warnSupabaseError: vi.fn()
}));

vi.mock("./supabaseClient", () => ({
  get supabase() {
    return mocks.client;
  },
  isMissingSupabaseSchemaError: vi.fn(() => false),
  isSupabaseConfigured: true,
  isSupabaseSetupError: vi.fn(() => false),
  migrationRequiredError: (feature) => {
    const error = new Error(`${feature} require database migration.`);
    error.code = "MIGRATION_REQUIRED";
    return error;
  },
  missingSupabaseEnvMessage: "Supabase env missing",
  supabaseSetupError: (message) => new Error(message),
  warnSupabaseError: (...args) => mocks.warnSupabaseError(...args),
  getCurrentUser: (...args) => mocks.getCurrentUser(...args)
}));

function createCardsClientMock({ beforeCard, updatedCard }) {
  const state = {
    fromTables: [],
    selectArgs: [],
    updateArgs: [],
    phase: null
  };

  const query = {
    select(arg) {
      state.selectArgs.push(arg);
      if (!state.phase) state.phase = "select";
      return query;
    },
    update(arg) {
      state.updateArgs.push(arg);
      state.phase = "update";
      return query;
    },
    eq() {
      return query;
    },
    order() {
      return query;
    },
    in() {
      return query;
    },
    maybeSingle: vi.fn(async () =>
      state.phase === "update"
        ? { data: updatedCard, error: null }
        : { data: beforeCard, error: null }
    ),
    single: vi.fn(async () => ({ data: updatedCard, error: null }))
  };

  const client = {
    from: vi.fn((table) => {
      state.fromTables.push(table);
      state.phase = null;
      return query;
    }),
    rpc: vi.fn()
  };

  return { client, state };
}

describe("cardRepository update flow", () => {
  beforeEach(() => {
    mocks.client = null;
    mocks.getCurrentUser.mockReset();
    mocks.warnSupabaseError.mockReset();
    vi.resetModules();
  });

  it("updates a card with select(*) only and does not require embedded column titles", async () => {
    const { client, state } = createCardsClientMock({
      beforeCard: {
        id: "card-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "Before",
        description: "Old",
        assigned_to: null,
        created_by: "user-1",
        position: 0,
        status: "active",
        labels: [],
        version: 7,
        created_at: "2026-06-12T00:00:00.000Z",
        updated_at: "2026-06-12T00:00:00.000Z"
      },
      updatedCard: {
        id: "card-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "Updated",
        description: "New",
        assigned_to: null,
        created_by: "user-1",
        position: 0,
        status: "active",
        labels: [],
        version: 8,
        created_at: "2026-06-12T00:00:00.000Z",
        updated_at: "2026-06-12T00:05:00.000Z"
      }
    });

    mocks.client = client;
    mocks.getCurrentUser.mockResolvedValue({ data: { id: "user-1" }, error: null });

    const { updateCard } = await import("./cardRepository");
    const result = await updateCard("card-1", { title: "Updated", description: "New" }, 7);

    expect(result.error).toBeNull();
    expect(result.data.title).toBe("Updated");
    expect(result.data.column).toBe("col-1");
    expect(state.fromTables).toEqual(["cards", "cards"]);
    expect(state.selectArgs).toEqual(["*", "*"]);
    expect(state.selectArgs.some((arg) => String(arg).includes("columns(title)"))).toBe(false);
  });
});
