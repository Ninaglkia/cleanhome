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
