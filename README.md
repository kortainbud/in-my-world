# In My World

Turn any idea into a whole world. Type one sentence and get an animated, narrated, captioned 9:16 video in a blocky 3D style (Roblox-inspired, with a Minecraft-inspired voxel alternative).

This repo contains the marketing site, the authenticated studio, the generation pipeline, and a real rendering engine. In development mode it produces **real MP4 files end to end** on a laptop with no API keys.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — defaults work for development
npm run dev -- -p 5260
```

Open http://localhost:5260, create an account, type an idea, press **Create my world**, and keep the tab open while it renders.

Requirements: Node 20+, a recent Chrome/Edge/Safari (WebCodecs H.264 encoding). Narration in development uses macOS system voices; on other platforms set `VOICE_PROVIDER=none`.

## How generation works

```
Create ─▶ POST /api/generate ─▶ credit hold + job ─▶ server pipeline ─▶ awaiting_render ─▶ render agent ─▶ MP4 upload ─▶ completed
                                                     │ 1 story (Claude / template)
                                                     │ 2 characters (library + new designs)
                                                     │ 3 world (environments, props)
                                                     │ 4 animation (actions, cameras)
                                                     │ 5 narration (TTS per scene, measured)
                                                     │ 6 editing (timeline, captions, sfx, music)
                                                     └ 7 render (frames → H.264 + AAC MP4)
```

- The story model can only request assets the renderer can draw: environments, actions, cameras, props and sound effects are fixed vocabularies (`src/lib/engine/types.ts`), enforced by structured output.
- `compileTimeline` turns the script and the measured narration clips into a frame-exact timeline: scene timings, word-level captions, sound cues and the music mood.
- The renderer (`src/lib/render/`) is deterministic Three.js. Original blocky avatars and procedural worlds come from one style kit, so every asset exists in both styles. Captions, speech bubbles, labels and transitions are composited on a 2D canvas. Music and sound effects are synthesized per video.
- Encoding uses WebCodecs + `mp4-muxer`: H.264 video and AAC audio (Opus fallback). Uploads are checked server-side (MP4 signature, dimensions, duration) before a job is marked complete.
- **Render agent:** the signed-in studio tab claims ready jobs on a short lease, uploads real scene stills as it reaches them, and reports real frame counts. If the tab closes, the lease expires and another agent picks the job up. A server render farm (Remotion/Blender/headless GPU) slots in as another agent with the same protocol (`/api/render/*`).
- Failures retry up to 3 times when retryable. If generation finally fails, the credit hold is refunded once (enforced by a unique index in SQL).
- Progress shown in the UI is the server's real job state. Nothing is simulated.

## Modes and providers

| Capability | Development | Production |
|---|---|---|
| Story | Claude if `ANTHROPIC_API_KEY` is set, otherwise the **template engine** (not AI; labelled in the UI) | Claude (`claude-opus-5-5`, structured output, server-side refusal fallback). Without a key, generation returns a clear 503. |
| Voice | macOS `say` voices, measured per clip | `none` (captions only) until a TTS adapter is added |
| Rendering | In-browser render agent | Same, or a server agent using the same protocol |
| Data | Supabase (Postgres + Storage) | Same |
| Payments | Whatever is configured (Stripe and/or Solana); dev-only credit grant and plan switch | Same |

Dev-only endpoints (`/api/dev/*`) return 404 in production mode.

## Project structure

```
src/
  app/
    (site)/            marketing site: home, explore, characters, pricing, docs, legal, /v/[id] share page
    (auth)/            sign-in, sign-up (email + optional wallet)
    studio/            Create, My Studio, project progress/player, Explore, Characters (+ builder), Templates, Billing, Settings
    api/               auth, generate, quote, projects, render agent protocol, media (range requests), characters, explore, credits, billing, wallet, dev
  components/          UI kit, video card/player, explore, studio screens, site sections
  config/              plans.ts (prices, credits, limits — placeholders), site.ts (copy, style labels, templates)
  data/samples.json    sample videos exported from the engine (files in public/samples)
  lib/
    engine/            shared types, characters library, template story engine, timeline compiler
    render/            Three.js renderer, avatars, worlds, props, animation, audio mix, MP4 encoder
    server/            store, auth, credits ledger, pipeline/worker, providers (story, voice), payments, wallets, views
    client/            fetch helper, account context, portrait renderer
  proxy.ts             studio route gate (Next 16 "proxy", formerly middleware)
supabase/migrations/   production schema with RLS
```

## Environment variables

See `.env.example`. None are required for development.

| Variable | Purpose |
|---|---|
| `IMW_MODE` | `development` (default) or `production` |
| `DATA_DIR` | Local store + media directory (default `.data`) |
| `ANTHROPIC_API_KEY` | Enables Claude story generation |
| `STORY_PROVIDER`, `STORY_MODEL` | Optional overrides |
| `VOICE_PROVIDER` | `macos-say` or `none` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments: plans (monthly) and credit packs |
| `SOLANA_RECEIVER_ADDRESS`, `SOLANA_CLUSTER`, `SOLANA_RPC_URL` | USDC/SOL credit-pack payments straight to your wallet, verified on-chain |
| `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` | Database and media storage (required) |
| `SMTP_USER`, `SMTP_PASS` (Gmail + app password) or `RESEND_API_KEY`, `EMAIL_FROM`; `SITE_URL` | Password-reset emails (in development without these, emails print to the server console) |
| `ALLOW_TEMPLATE_STORIES` | `true` lets production use the template story engine (labelled "not AI") |

## Database

Run `supabase/setup-v2.sql` once in the Supabase SQL Editor. Each table stores a JSON document (`data`) with indexed columns generated from it; the app's types in `src/lib/server/models.ts` map 1:1. Access goes through `src/lib/server/data.ts`:

- Updates are compare-and-swap on a `version` column, so concurrent serverless requests can't overwrite each other.
- A trigger refuses any credit debit that would take a balance below zero; unique indexes allow one refund per job and one purchase credit per payment.
- Row-level security is on with no policies: only the server (service role key) can read or write. The browser never talks to the database.
- Media lives in private Storage buckets (`videos`, `thumbs`, `previews`, `audio`). `/api/media/*` checks access, then redirects to a short-lived signed URL. The render agent uploads finished MP4s straight to Storage via signed upload URLs, and the server verifies them before completing the job.
- There's no background worker: the story/cast/timeline stages run when the project page (or any studio tab's render agent) calls `/api/jobs/:id/advance`, under a short lease. This works on serverless hosts such as Netlify.

## Adding providers

- **Story:** `src/lib/server/providers/story.ts` — implement `generateStory` for another LLM. It must return a `StoryPlan` drawn from the engine vocabularies.
- **Voice:** `src/lib/server/providers/voice.ts` — implement `synthesize(text, voice, key)` returning a stored clip and its exact duration (ElevenLabs/OpenAI etc.).
- **Render:** any process that speaks the `/api/render/*` lease protocol.
- **Payments:** `src/lib/server/stripe.ts` (Checkout + signed webhook) and `src/lib/server/solana.ts` (quote with a unique reference key, on-chain verification of recipient/token/amount). Both fulfil through `fulfill()` in `payments.ts`, exactly once.

## Samples

The sample videos on the site and in Explore were rendered by this engine in development mode with the template story engine, and they're labelled as samples. To regenerate them, sign in on a dev server and run:

```bash
curl -X POST localhost:5260/api/dev/seed-samples -b <session cookie>
# keep a /studio tab open until they render, then:
curl -X POST localhost:5260/api/dev/export-samples -b <session cookie>
```

## Notes

- Style names ("Roblox", "Minecraft") are configurable in `src/config/site.ts`. All characters, worlds and textures are original. The site footer states non-affiliation. Get trademark review before launch.
- Prices and allowances in `src/config/plans.ts` are placeholders.
