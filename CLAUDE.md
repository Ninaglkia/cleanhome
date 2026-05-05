# CleanHome RN — Project Rules

## ⚠️ MANDATORY: Always Use Superpowers Skills

**This is non-negotiable.** Before doing ANYTHING in this project, invoke the relevant Superpowers skill via the `Skill` tool. No exceptions.

### Required skill invocations by task type

| Task | Skill to invoke FIRST |
|------|----------------------|
| New feature, screen, component, behavior | `superpowers:brainstorming` |
| Any bug, test failure, unexpected behavior | `superpowers:systematic-debugging` |
| Implementing a feature/bugfix | `superpowers:test-driven-development` |
| Multi-step task with spec/requirements | `superpowers:writing-plans` |
| Executing a written plan | `superpowers:executing-plans` |
| Before claiming work is "done" / committing | `superpowers:verification-before-completion` |
| Creating/editing skills | `superpowers:writing-skills` |
| 2+ independent tasks | `superpowers:dispatching-parallel-agents` |
| Receiving code review feedback | `superpowers:receiving-code-review` |
| Requesting code review | `superpowers:requesting-code-review` |
| Need isolation from current workspace | `superpowers:using-git-worktrees` |
| Implementation done, ready to integrate | `superpowers:finishing-a-development-branch` |

### Rules

1. **Skill invocation comes BEFORE clarifying questions, exploration, or any tool call.** Even a 1% chance a skill applies = invoke it.
2. **If multiple skills apply**, process skills first (brainstorming, debugging) then implementation skills (TDD, etc.).
3. **Never rationalize away skills.** "This is simple", "I know what to do", "skill is overkill" — these thoughts mean STOP and use the skill anyway.
4. **Rigid skills (TDD, debugging) must be followed exactly.** Don't adapt away the discipline.
5. **`superpowers:brainstorming` terminates by invoking `superpowers:writing-plans`.** Not frontend-design, not anything else.

## Project Context

- **Stack:** Expo + React Native + TypeScript + NativeWind + Supabase + Stripe Connect
- **Working dir:** `/Users/ninomarianolai/CleanHomeRN`
- **Build:** Always use dev build (`com.cleanhome.app`), NEVER Expo Go
- **Language:** Italian for conversation, English for code

## Development Workflow

1. Brainstorm → 2. Plan → 3. TDD → 4. Verify → 5. Commit & push

**Always commit and push after changes** — don't ask, just do it.

## ⚠️ MANDATORY: Always use the `frontend-dev` agent for any frontend work

For ANY task touching React Native UI, layout, components, hooks UI, navigation, gestures, animations, or styling in this project — **dispatch the `frontend-dev` agent via the Agent tool**. Do NOT do frontend work inline.

### Why
Inline frontend work in this project repeatedly produced fragile fixes (e.g. iOS-specific Pressable+flex bugs, touch-area gestures eating map drag). The `frontend-dev` agent applies battle-tested patterns and verifies TypeScript + Metro bundle before committing.

### When to use frontend-dev
- New screens or components
- Layout/styling fixes
- Touch/gesture issues (`pointerEvents`, hit areas, scroll conflicts)
- Animations and Reanimated work
- Navigation flows
- Any change in `app/`, `components/`, `lib/hooks/` related to UI

### When you can work inline
- Backend (Edge Functions, Supabase RPCs/migrations) → use `backend-dev` agent or inline
- TypeScript types, pure logic helpers in `lib/`
- Memory/CLAUDE.md/config edits
- Reading files for context

### Constraints to always pass to `frontend-dev`
- **NEVER `git add -A` / `git add .`** — repo has pre-commit rules blocking files with secrets (`.env.local.backup` is local-only). Always `git add <specific-files>`.
- Verify TypeScript: `cd /Users/ninomarianolai/CleanHomeRN && npx tsc --noEmit`
- Verify Metro bundle has no SyntaxError before declaring done
- Conventional commits in English, NO `Co-Authored-By` footer (disabled globally)
- Branch: `main`
- Italian for UI text, English for code/comments

## Auto-reload dev app after every edit

**Don't ask the user to shake the phone or reload manually.** After every edit to runtime code (`app/`, `components/`, `lib/`), trigger the dev client reload via:

```bash
curl -X POST http://localhost:8081/reload
```

This broadcasts a reload command to all connected Expo dev clients on the LAN. Do this AFTER `npx tsc --noEmit` passes, BEFORE the commit. Skip the curl only when the change is config-only (CLAUDE.md, memory files, json that requires app restart).

If Metro isn't running on port 8081, surface that to the user with a one-line message instead of attempting reload.

## Key Files Reference

- `app/listing/index.tsx` — main listing editor (large file, refactor pending)
- `app/listings/index.tsx` — multi-listing list page
- `app/(tabs)/profile.tsx` — dual profile (CleanerView/ClientView)
- `app/(tabs)/home.tsx` — client map search with PostGIS
- `app/cleaner/[id].tsx` — cleaner public profile (in progress)
- `app/booking/new.tsx` — booking flow with Payment Sheet
- `lib/api.ts` — all Supabase API functions
- `lib/types.ts` — TypeScript types
- `supabase/functions/` — Edge Functions (stripe-*, etc.)

## Naming Convention (FIXED — do not "fix")

- `CleanerView` = shown to CLEANERS (green/blue theme)
- `ClientView` = shown to CLIENTS (orange/brown theme)
- Color constants are intentionally inverted in code; behavior is correct.
