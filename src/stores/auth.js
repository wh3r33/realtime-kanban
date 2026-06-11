import { defineStore } from "pinia";
import { getCurrentProfile, getCurrentUser, isSupabaseConfigured, missingSupabaseEnvMessage, supabase, warnSupabaseError } from "../services/supabaseClient";

function profileName(user, profile) {
  return profile?.name || user?.user_metadata?.name || user?.email || "Supabase user";
}

let initializePromise = null;

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
    async initializeSession() {
      if (!isSupabaseConfigured) {
        this.session = { status: "setup_required", workspaceId: null };
        this.errorMessage = missingSupabaseEnvMessage;
        this.initialized = true;
        return;
      }
      this.loading = true;
      this.errorMessage = "";
      this.profileErrorMessage = "";
      const { data: user, error } = await getCurrentUser();
      if (error || !user) {
        this.session = { status: "anonymous", workspaceId: null };
        this.currentUserId = null;
        this.currentUserName = "";
        this.profile = null;
        this.loading = false;
        this.initialized = true;
        if (error) this.errorMessage = error.message;
        return;
      }
      const { data: profile, error: profileError } = await getCurrentProfile();
      warnSupabaseError("profile initialization failed", profileError);
      this.currentUserId = user.id;
      this.currentUserName = profileName(user, profile);
      this.profile = profile;
      this.session = { status: "authenticated", workspaceId: "supabase" };
      if (profileError) this.profileErrorMessage = profileError.message;
      this.loading = false;
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
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      this.currentUserId = null;
      this.currentUserName = "";
      this.currentRole = "viewer";
      this.profile = null;
      this.profileErrorMessage = "";
      this.errorMessage = "";
      this.initialized = true;
      this.session = { status: isSupabaseConfigured ? "anonymous" : "setup_required", workspaceId: null };
    }
  }
});
