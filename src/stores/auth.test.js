import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";

describe("auth store permissions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("allows owners to manage workspace and mutate cards", () => {
    const auth = useAuthStore();
    auth.setBoardRole("owner");

    expect(auth.canManageWorkspace).toBe(true);
    expect(auth.canInviteMembers).toBe(true);
    expect(auth.canMutateCards).toBe(true);
    expect(auth.isViewer).toBe(false);
  });

  it("allows editors to invite and mutate cards but not manage members", () => {
    const auth = useAuthStore();
    auth.setBoardRole("editor");

    expect(auth.canManageWorkspace).toBe(false);
    expect(auth.canInviteMembers).toBe(true);
    expect(auth.canMutateCards).toBe(true);
  });

  it("keeps viewers read-only", () => {
    const auth = useAuthStore();
    auth.setBoardRole("viewer");

    expect(auth.canManageWorkspace).toBe(false);
    expect(auth.canInviteMembers).toBe(false);
    expect(auth.canMutateCards).toBe(false);
    expect(auth.isViewer).toBe(true);
  });
});
