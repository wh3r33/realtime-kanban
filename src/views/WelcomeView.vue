<template>
  <section id="welcome" class="welcome-screen" aria-label="Welcome Experience">
    <div class="paper-grid" aria-hidden="true"></div>

    <div class="welcome-system">
      <div class="system-badge">
        <span class="pulse-dot"></span>
        <span>LIVE SYSTEM</span>
      </div>
    </div>

    <div class="welcome-copy">
      <p class="kicker reveal">realtime-kanban Workspace</p>
      <h1 class="poster-title" aria-label="Realtime Kanban">
        <span class="line-real reveal">REALTIME</span>
        <span class="overlay-word pixel-outline reveal">Connected</span>
        <span class="line-kanban reveal">KANBAN</span>
      </h1>
      <div class="welcome-actions reveal">
        <div class="welcome-action-set" aria-label="Welcome actions">
          <RouterLink class="enter-button" to="/boards">
            <span>Continue to boards</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </RouterLink>
          <RouterLink class="button secondary" to="/boards/board-main">Open live board</RouterLink>
          <RouterLink class="button secondary" to="/auth/login">Sign in</RouterLink>
        </div>
        <p>
          Collaborative board prototype with visible live state, motion feedback, and editorial workspace structure.
        </p>
      </div>
    </div>

    <div class="welcome-side-note reveal">
      <span>SYNC LEDGER</span>
      <strong>04 active collaborators</strong>
      <small>Realtime presence, edits, locks and conflicts simulated locally.</small>
    </div>

    <div class="tech-bar" aria-label="Technical information">
      <div><span>ONLINE USERS</span><strong>04</strong></div>
      <div><span>ACTIVE BOARDS</span><strong>01</strong></div>
      <div><span>SYNC STATUS</span><strong>STABLE</strong></div>
      <div><span>VERSION</span><strong>0.9.6</strong></div>
    </div>
  </section>
</template>
