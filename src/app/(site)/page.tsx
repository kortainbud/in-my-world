import Link from "next/link";
import type { ReactNode } from "react";
import samplesJson from "@/data/samples.json";
import type { SampleEntry } from "@/lib/server/views";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { Examples } from "@/components/site/home-client";
import { LiveDemo } from "@/components/site/live-demo";
import { FAQ, Pricing } from "@/components/site/pricing";
import { FloatingBricks, HorizontalScroll, PopChip, Scene } from "@/components/site/fx";
import { HeroTV, WavingCharacter } from "@/components/site/hero-tv";
import { Portrait } from "@/components/portrait";

const samples = samplesJson as SampleEntry[];
const byId = (id: string) => OFFICIAL_CHARACTERS.find((c) => c.id === id)!.appearance;

const secondary = "inline-flex h-11 items-center justify-center rounded-full bg-bg-2 px-5 text-body font-medium text-fg transition-colors hover:bg-bg-3";
const h2 = "text-display-sm font-medium leading-[1.03] tracking-[-0.045em] sm:text-display";
const card = "w-[min(84vw,500px)] shrink-0 snap-start rounded-[24px] bg-bg-2 p-6 sm:p-7";
const inner = "rounded-[16px] bg-[var(--card)]";
const container = "mx-auto w-full max-w-[1120px] px-5 sm:px-6";

/** One section rhythm for the whole page. */
function Section({ id, title, aside, children, className = "" }: { id?: string; title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`${container} scroll-mt-24 py-16 sm:py-20 ${className}`}>
      {title && (
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 sm:mb-12">
          <h2 className={`${h2} max-w-[760px]`}>{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export default function Home() {
  const story = samples.find((s) => s.story?.sheet) ?? samples[0];
  const formatCards = [
    { img: "card-day", s: samples.find((x) => x.format === "strange_world"), t: "a strange world", d: "one rule, one town, one person who breaks it. made to be shared.", tag: "standalone" },
    { img: "card-night", s: samples.find((x) => x.format === "mystery_series"), t: "a mystery series", d: "every episode answers one question and opens a bigger one.", tag: "part 1 → part 2" },
    { img: "card-sunset", s: samples.find((x) => x.format === "impossible_choice"), t: "an impossible choice", d: "two doors, both with a price. let the comments decide.", tag: "a or b" },
  ];
  return (
    <div className="relative">
      <FloatingBricks />

      {/* 1 — Hero: the promise, and the input right there */}
      <section className={`${container} grid items-center gap-10 pb-12 pt-10 sm:pt-14 lg:grid-cols-[1.08fr_1fr] lg:gap-10 lg:pb-16`}>
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-bg-2 px-3 py-1 text-small font-medium text-fg-2">
            <span className="h-2 w-2 rounded-[2px] bg-[#e63946]" /> roblox <span className="h-2 w-2 rounded-[2px] bg-[#7fd14f]" /> minecraft
          </p>
          <h1 className="mt-6 text-display font-medium leading-[0.95] tracking-[-0.055em] sm:text-display lg:text-display-lg">your imagination. their next favourite video.</h1>
          <p className="mt-6 max-w-[480px] text-lead leading-[1.7] text-fg-2">
            type one sentence and get a whole animated world — written, cast, narrated and captioned for you. no animation skills, no editing.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-body text-fg-3">
            <Link href="#examples" className={secondary}>
              watch examples
            </Link>
            <span>free to start · made for tiktok, reels and shorts</span>
          </div>
        </div>
        <div className="relative pt-24 sm:pt-28">
          {/* Milo stands on top of the TV and waves. */}
          <WavingCharacter id="ch_milo" className="absolute right-[8%] top-0 z-10 h-[150px] w-[120px] sm:h-[190px] sm:w-[150px]" />
          <HeroTV />
        </div>
      </section>

      {/* 2 — What happens after you press create */}
      <section className={`${container} pb-16 sm:pb-20`}>
        <p className="mb-4 font-mono text-caption text-fg-3">what happens next · pick a story to see it built</p>
        <LiveDemo samples={samples} />
      </section>

      {/* 3 — The idea in one breath (characters hide in the bricks) */}
      <Section>
        <p className="max-w-[980px] text-page font-medium leading-[1.25] tracking-[-0.04em] sm:text-display">
          one sentence <PopChip id="ch_milo" /> becomes a story with a rule, a twist <PopChip id="ch_nova" /> and a cliffhanger — narrated, captioned and animated in a world <PopChip id="ch_bricks" /> built just for it.
        </p>
      </Section>

      {/* 4 — Proof */}
      <Section
        id="examples"
        title="strange worlds. endless stories."
        aside={
          <Link href="/explore" className={secondary}>
            explore more
          </Link>
        }
      >
        <Examples samples={samples} />
      </Section>

      {/* 5 — Formats */}
      <Section title="three ways to tell it.">
        <div className="grid gap-6 md:grid-cols-3">
          {formatCards.map((c, i) => (
            <article key={c.t} className="group">
              <div className="relative overflow-hidden rounded-[22px]">
                <Scene name={c.img} night="card-night" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 font-mono text-micro text-[#131316]">{c.tag}</span>
                <div className="relative flex justify-center px-6 pt-12">
                  {c.s && (
                    <div className={`w-[150px] overflow-hidden rounded-t-[16px] border-[5px] border-b-0 border-[#131316] bg-black transition-transform duration-500 ease-[cubic-bezier(.3,1.4,.5,1)] group-hover:-translate-y-3 group-hover:rotate-0 ${i === 1 ? "rotate-[2deg]" : "rotate-[-2deg]"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.s.thumb} alt={c.s.title} className="aspect-[9/12] w-full object-cover object-top" />
                    </div>
                  )}
                </div>
              </div>
              <h3 className="mt-5 text-title font-semibold tracking-[-0.03em]">{c.t}</h3>
              <p className="mt-1.5 text-body leading-relaxed text-fg-2">{c.d}</p>
              {c.s && (
                <Link href={`/sign-up?next=${encodeURIComponent(`/studio?prompt=${encodeURIComponent(c.s.prompt)}&format=${c.s.format}`)}`} className="mt-3 inline-block text-body font-semibold">
                  try “{c.s.title.toLowerCase()}” →
                </Link>
              )}
            </article>
          ))}
        </div>
      </Section>

      {/* 6 — Built in (pins and scrolls sideways on desktop) */}
      <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20">
        <HorizontalScroll
          header={
            <div className={`${container} mb-10 flex items-end justify-between gap-6 sm:mb-12`}>
              <h2 className={h2}>everything a story needs, built in.</h2>
              <p className="hidden shrink-0 font-mono text-caption text-fg-3 lg:block">keep scrolling →</p>
            </div>
          }
        >
          <span aria-hidden className="w-[max(4px,calc((100vw-1120px)/2))] shrink-0" />
          <article className={card}>
            <h3 className="text-title font-semibold tracking-[-0.03em]">every story gets a sheet</h3>
            <p className="mt-2 text-body text-fg-2">the rule, why everyone obeys it, the secret behind it, the twist and the hook for next time.</p>
            {story?.story?.sheet && (
              <dl className={`mt-6 divide-y divide-line-soft text-small ${inner}`}>
                {[["rule", story.story.sheet.rule], ["secret", story.story.sheet.secret], [`twist · ${story.story.sheet.twistType.replace(/_/g, " ")}`, story.story.sheet.twist]].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[86px_1fr] gap-2 px-4 py-2.5">
                    <dt className="font-mono text-micro leading-5 text-fg-3">{k}</dt>
                    <dd className="leading-5 text-fg-2">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
          <article className={card}>
            <h3 className="text-title font-semibold tracking-[-0.03em]">turn it into a series</h3>
            <p className="mt-2 text-body text-fg-2">finish part 1, press one button. same world, same cast, a new twist.</p>
            <ul className={`mt-6 space-y-1 p-2 ${inner}`}>
              {samples.filter((x) => x.format === "mystery_series").slice(0, 3).map((x, k) => (
                <li key={x.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.thumb} alt="" className="h-12 w-[27px] rounded-[5px] object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold">{x.title.toLowerCase()}</span>
                    <span className="block truncate text-caption text-fg-3">{x.story?.sheet?.continuation.toLowerCase()}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-micro font-medium ${k === 0 ? "bg-[#d4f5a3] text-[#131316]" : "bg-bg-2 text-fg-2"}`}>{k === 0 ? "make part 2" : "part 1"}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className={card}>
            <h3 className="text-title font-semibold tracking-[-0.03em]">characters that are yours</h3>
            <p className="mt-2 text-body text-fg-2">pick skin tone, hair and outfit — or randomize. they keep their look in every scene.</p>
            <div className={`mt-6 grid grid-cols-4 gap-2 p-3 ${inner}`}>
              {OFFICIAL_CHARACTERS.slice(0, 8).map((c) => (
                <span key={c.id} className="flex flex-col items-center rounded-[10px] bg-bg-2 pt-1">
                  <Portrait appearance={c.appearance} className="h-14 w-12" />
                  <span className="pb-1.5 text-caption font-medium">{c.name.toLowerCase()}</span>
                </span>
              ))}
            </div>
          </article>
          <article className={card}>
            <h3 className="text-title font-semibold tracking-[-0.03em]">a sound you’ll recognise</h3>
            <p className="mt-2 text-body text-fg-2">the same opening sting, music that follows the story, and silence right before the twist.</p>
            <div className={`mt-6 p-4 ${inner}`} aria-hidden>
              <div className="flex h-24 items-end gap-[3px]">
                {Array.from({ length: 48 }, (_, k) => {
                  const twist = k >= 30 && k < 34;
                  const h = twist ? 3 : k === 34 ? 96 : 18 + Math.abs(Math.sin(k * 0.7)) * 45 + (k > 18 && k < 30 ? (k - 18) * 2.5 : 0);
                  return <span key={k} className="flex-1 rounded-[2px]" style={{ height: `${Math.min(96, h)}%`, background: k === 34 ? "#e63946" : twist ? "transparent" : "var(--fg-3)" }} />;
                })}
              </div>
              <div className="mt-2 flex justify-between font-mono text-micro text-fg-3">
                <span>hook</span>
                <span>escalation</span>
                <span className="text-[#e63946]">twist</span>
                <span>cliffhanger</span>
              </div>
            </div>
          </article>
          <article className={card}>
            <h3 className="text-title font-semibold tracking-[-0.03em]">know what works</h3>
            <p className="mt-2 text-body text-fg-2">every script is checked against the editorial rules, then you see where people stop watching.</p>
            <ul className={`mt-6 space-y-2 p-4 text-small ${inner}`}>
              {["starts with an interesting premise", "the conflict escalates rather than repeats", "the twist changes what you understood", "the ending opens a real question"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#28c840] text-white">
                    <svg width="8" height="8" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </article>
          <span aria-hidden className="w-[max(4px,calc((100vw-1120px)/2))] shrink-0" />
        </HorizontalScroll>
      </section>

      {/* 7 — Characters: build your own */}
      <Section
        title="build your own cast."
        aside={
          <Link href="/sign-up?next=/studio/characters/new" className={secondary}>
            build a character
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <Link href="/characters" className="block overflow-hidden rounded-[28px]">
            <Scene name="lineup" alt="Nine characters with different skin tones, hairstyles and outfits" className="w-full" />
          </Link>
          <div>
            <p className="text-lead text-fg-2">every skin tone, hairstyle, outfit and accessory. build one piece by piece, or hit randomize until someone feels right.</p>
            <ul className="mt-6 space-y-3 text-body">
              {[
                ["#4A2E1F", "nine skin tones, seven hairstyles, hats, capes, shades and more"],
                ["#F5C518", "works in both styles — smooth blocks or voxels"],
                ["#3D7BF2", "save them, reuse them, share them — or keep them private"],
              ].map(([c, t]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-3 w-5 shrink-0 rounded-[3px]" style={{ background: c, boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.2)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 8 — Pricing */}
      <Section id="pricing" title="start free. upgrade when it hits.">
        <Pricing />
      </Section>

      {/* 9 — Questions */}
      <Section id="questions" className="grid gap-10 md:grid-cols-[1fr_1.45fr]">
        <div>
          <h2 className={h2}>questions.</h2>
          <p className="mt-4 text-body text-fg-2">
            something else? <Link href="/contact" className="font-semibold text-fg">get in touch</Link>.
          </p>
          <Portrait appearance={byId("ch_odysseyyy")} full pose="wave" className="mt-8 hidden h-48 w-40 md:block" />
        </div>
        <FAQ />
      </Section>
    </div>
  );
}
