import { defineStore } from "pinia";
import {
  getCurrentProfile,
  getCurrentSession,
  getCurrentUser,
  isSupabaseConfigured,
  missingSupabaseEnvMessage,
  supabase,
  warnSupabaseError
} from "../services/supabaseClient";

function profileName(user, profile) {
  return profile?.name || user?.user_metadata?.name || user?.email || "Supabase user";
}

let initializePromise = null;
let authSubscription = null;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    currentUserId: null,
    currentUserName: "",
    currentRole: "viewer",
    profile: null,
    session: { status: isSupabaseConfigured ? "loading" : "setup_required", workspaceId: null },
    invitation: { activeInviteId: null, status: "not_connected" },
    loading: false,
    initialized: false,
    profileErrorMessage: "",
    errorMessage: isSupabaseConfigured ? "" : missingSupabaseEnvMessage
  }),
  getters: {
    isConfigured: () => isSupabaseConfigured,
    isAuthenticated: (state) => state.session.status === "authenticated",
    isAuthReady: (state) => state.initialized && state.session.status !== "loading",
    canManageWorkspace: (state) => state.currentRole === "owner",
    canMutateCards: (state) => ["owner", "editor"].includes(state.currentRole),
    isViewer: (state) => state.currentRole === "viewer"
  },
  actions: {
    async initialize() {
      if (initializePromise) return initializePromise;
      if (this.initialized && this.session.status !== "loading") return;
      initializePromise = this.initializeSession().finally(() => {
        initializePromise = null;
      });
      return initializePromise;
    },
    bindAuthListener() {
      if (!isSupabaseConfigured || !supabase || authSubscription) return;
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        globalThis.setTimeout(async () => {
          if (!session?.user) {
            this.applyAnonymousSession();
            return;
          }
          await this.applyAuthenticatedUser(session.user);
        }, 0);
      });
      authSubscription = data?.subscription || null;
    },
    async initializeSession() {
      if (!isSupabaseConfigured) {
        this.session = { status: "setup_required", workspaceId: null };
        this.errorMessage = missingSupabaseEnvMessage;
        this.initialized = true;
        return;
      }
      this.bindAuthListener();
      this.loading = true;
      this.errorMessage = "";
      this.profileErrorMessage = "";
      const { data: session, error } = await getCurrentSession();
      if (error || !session?.user) {
        this.applyAnonymousSession();
        this.loading = false;
        if (error) this.errorMessage = error.message;
        return;
      }
      await this.applyAuthenticatedUser(session.user);
      this.loading = false;
      this.initialized = true;
    },
    applyAnonymousSession() {
      this.session = { status: isSupabaseConfigured ? "anonymous" : "setup_required", workspaceId: null };
      this.currentUserId = null;
      this.currentUserName = "";
      this.currentRole = "viewer";
      this.profile = null;
      this.loading = false;
      this.initialized = true;
    },
    async applyAuthenticatedUser(user) {
      const { data: profile, error: profileError } = await getCurrentProfile();
      warnSupabaseError("profile initialization failed", profileError);
      this.currentUserId = user.id;
      this.currentUserName = profileName(user, profile);
      this.profile = profile;
      this.session = { status: "authenticated", workspaceId: "supabase" };
      if (profileError) this.profileErrorMessage = profileError.message;
      this.initialized = true;
    },
    setBoardRole(role) {
      this.currentRole = role || "viewer";
    },
    async submitAuth(mode, payload) {
      if (!isSupabaseConfigured || !supabase) return { ok: false, message: this.errorMessage };
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(payload.email);
        return { ok: !error, message: error?.message || "Password reset email requested." };
      }
      const authMethod = mode === "register" ? "signUp" : "signInWithPassword";
      const { error } = await supabase.auth[authMethod]({
        email: payload.email,
        password: payload.password,
        options: mode === "register" ? { data: { name: payload.name } } : undefined
      });
      warnSupabaseError(`auth ${mode} failed`, error);
      if (error) return { ok: false, message: error.message };
      this.initialized = false;
      initializePromise = null;
      await this.initialize();
      return { ok: true, message: "Signed in with Supabase." };
    },
    async acceptInvitation(token) {
      if (!isSupabaseConfigured || !supabase) return { ok: false, message: this.errorMessage };
      if (!token) return { ok: false, message: "Invitation token is missing." };
      const { acceptInvitation } = await import("../services/memberRepository");
      const { data, error } = await acceptInvitation(token);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Invitation accepted.", boardId: data?.boardId };
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      this.profileErrorMessage = "";
      this.errorMessage = "";
      this.applyAnonymousSession();
    }
  }
});
