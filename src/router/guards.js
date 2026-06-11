export function authGuardDecision(to, sessionStatus) {
  const isAuthenticated = sessionStatus === "authenticated";
  const isSetupRequired = sessionStatus === "setup_required";
  const path = to.fullPath || to.path;
  const redirectTarget = typeof to.query?.redirect === "string" ? to.query.redirect : "/boards";

  if (to.meta?.guestOnly && isAuthenticated) return redirectTarget.startsWith("/auth") ? "/boards" : redirectTarget;
  if (!to.meta?.requiresAuth) return true;
  if (isSetupRequired) return to.meta?.allowSetupRequired ? true : "/profile/setup";
  if (!isAuthenticated) return { path: "/auth/login", query: { redirect: path } };
  return true;
}
