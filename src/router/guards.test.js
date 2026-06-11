import { describe, expect, it } from "vitest";
import { authGuardDecision } from "./guards";

describe("authGuardDecision", () => {
  it("redirects anonymous protected routes to login with redirect query", () => {
    expect(authGuardDecision({ path: "/boards/b1", fullPath: "/boards/b1?x=1", meta: { requiresAuth: true }, query: {} }, "anonymous")).toEqual({
      path: "/auth/login",
      query: { redirect: "/boards/b1?x=1" }
    });
  });

  it("keeps setup-required sessions out of app routes except setup/profile", () => {
    expect(authGuardDecision({ path: "/boards", meta: { requiresAuth: true }, query: {} }, "setup_required")).toBe("/profile/setup");
    expect(authGuardDecision({ path: "/profile/setup", meta: { requiresAuth: true, allowSetupRequired: true }, query: {} }, "setup_required")).toBe(true);
  });

  it("prevents authenticated users from opening guest-only auth pages", () => {
    expect(authGuardDecision({ path: "/auth/login", meta: { guestOnly: true }, query: { redirect: "/boards/b1" } }, "authenticated")).toBe("/boards/b1");
    expect(authGuardDecision({ path: "/auth/login", meta: { guestOnly: true }, query: { redirect: "/auth/register" } }, "authenticated")).toBe("/boards");
  });
});
