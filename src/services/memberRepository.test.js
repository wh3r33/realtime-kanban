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
  getCurrentUser: (...args) => mocks.getCurrentUser(...args),
  isMissingSupabaseSchemaError: vi.fn(() => false),
  isSupabaseSetupError: vi.fn(() => false),
  migrationRequiredError: (feature) => {
    const error = new Error(`${feature} require database migration.`);
    error.code = "MIGRATION_REQUIRED";
    return error;
  },
  missingSupabaseEnvMessage: "Supabase env missing",
  supabaseSetupError: (message) => new Error(message),
  warnSupabaseError: (...args) => mocks.warnSupabaseError(...args)
}));

vi.mock("./activityRepository", () => ({
  createActivityLog: vi.fn(async () => ({ data: null, error: null }))
}));

function createQueryClient(rows = []) {
  const calls = [];
  const query = {
    select(value) {
      calls.push(["select", value]);
      return query;
    },
    ilike(column, value) {
      calls.push(["ilike", column, value]);
      return query;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },
    is(column, value) {
      calls.push(["is", column, value]);
      return query;
    },
    gt(column, value) {
      calls.push(["gt", column, value]);
      return query;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return { data: rows, error: null };
    }
  };
  const client = {
    from: vi.fn((table) => {
      calls.push(["from", table]);
      return query;
    }),
    functions: { invoke: vi.fn() },
    rpc: vi.fn()
  };
  return { client, calls };
}

describe("memberRepository invitation flow", () => {
  beforeEach(() => {
    mocks.client = null;
    mocks.getCurrentUser.mockReset();
    mocks.warnSupabaseError.mockReset();
    vi.resetModules();
  });

  it("creates invites through the invite-user function", async () => {
    const { client } = createQueryClient();
    client.functions.invoke.mockResolvedValueOnce({
      data: { invite: { id: "invite-1", board_id: "board-1", email: "teammate@example.com", role: "viewer" }, duplicate: false },
      error: null
    });
    mocks.client = client;

    const { createBoardInvitation } = await import("./memberRepository");
    const result = await createBoardInvitation("board-1", " Teammate@Example.com ", "viewer");

    expect(result.error).toBeNull();
    expect(result.invitation).toBeUndefined();
    expect(result.data.email).toBe("teammate@example.com");
    expect(client.functions.invoke).toHaveBeenCalledWith("invite-user", {
      body: { board_id: "board-1", email: "teammate@example.com", role: "viewer" }
    });
  });

  it("loads pending invites for the signed-in email from Supabase", async () => {
    const { client, calls } = createQueryClient([
      {
        id: "invite-1",
        board_id: "board-1",
        email: "teammate@example.com",
        role: "editor",
        boards: { title: "Roadmap" },
        inviter: { email: "owner@example.com", name: "Owner" }
      }
    ]);
    mocks.client = client;
    mocks.getCurrentUser.mockResolvedValueOnce({ data: { id: "user-1", email: "teammate@example.com" }, error: null });

    const { listPendingInvitationsForCurrentUser } = await import("./memberRepository");
    const result = await listPendingInvitationsForCurrentUser();

    expect(result.error).toBeNull();
    expect(result.data[0].boardName).toBe("Roadmap");
    expect(result.data[0].inviterEmail).toBe("owner@example.com");
    expect(calls).toContainEqual(["from", "board_invites"]);
    expect(calls).toContainEqual(["ilike", "email", "teammate@example.com"]);
    expect(calls).toContainEqual(["is", "accepted_at", null]);
    expect(calls).toContainEqual(["is", "declined_at", null]);
    expect(calls).toContainEqual(["is", "revoked_at", null]);
  });

  it("accepts and declines pending invitations through RPCs", async () => {
    const { client } = createQueryClient();
    client.rpc
      .mockResolvedValueOnce({ data: { board_id: "board-1", role: "editor" }, error: null })
      .mockResolvedValueOnce({ data: { board_id: "board-1" }, error: null });
    mocks.client = client;

    const { acceptPendingInvitation, declinePendingInvitation } = await import("./memberRepository");

    await expect(acceptPendingInvitation("invite-1")).resolves.toMatchObject({ data: { boardId: "board-1", role: "editor" }, error: null });
    await expect(declinePendingInvitation("invite-1")).resolves.toMatchObject({ data: { boardId: "board-1" }, error: null });
    expect(client.rpc).toHaveBeenNthCalledWith(1, "accept_board_invitation", { p_invitation_id: "invite-1" });
    expect(client.rpc).toHaveBeenNthCalledWith(2, "decline_board_invitation", { p_invitation_id: "invite-1" });
  });
});
