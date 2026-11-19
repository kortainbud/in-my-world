import Link from "next/link";
import samplesJson from "@/data/samples.json";
import type { SampleEntry } from "@/lib/server/views";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { Examples } from "@/components/site/home-client";
import { LiveDemo } from "@/components/site/live-demo";
import { FAQ, Pricing } from "@/components/site/pricing";
import { Brick, FloatingBricks, HorizontalScroll, PopChip, Scene } from "@/components/site/fx";
import { Portrait } from "@/components/portrait";

const samples = samplesJson as SampleEntry[];
const byId = (id: string) => OFFICIAL_CHARACTERS.find((c) => c.id === id)!.appearance;

const primary = "inline-flex h-12 items-center justify-center rounded-full bg-[var(--pill-bg)] px-6 text-[16px] font-medium text-[var(--pill-fg)] transition-colors hover:bg-[var(--pill-hover)]";
const secondary = "inline-flex h-12 items-center justify-center rounded-full bg-bg-2 px-6 text-[16px] font-medium text-fg transition-colors hover:bg-bg-3";
const h2 = "text-[40px] font-medium leading-[1.03] tracking-[-0.045em] sm:text-[56px]";
const card = "w-[min(86vw,520px)] shrink-0 snap-start rounded-[24px] bg-bg-2 p-6 sm:p-7";
const inner = "rounded-[16px] bg-[var(--card)]";

const STEPS = [
  { t: "type one sentence", d: "a rule, a what-if, a pov.", c: "#3d7bf2" },
  { t: "pick a format", d: "strange world, series or choice.", c: "#f5c518" },
  { t: "cast it", d: "the official crew, yours, or ours.", c: "#e63946" },
  { t: "post it", d: "a narrated, captioned mp4.", c: "#7fd14f" },
];

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

      {/* Hero: words on the left, a floating world on the right */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-6 px-5 pb-6 pt-8 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-bg-2 px-3 py-1 text-[13px] font-medium text-fg-2">
            <span className="h-2 w-2 rounded-[2px] bg-[#e63946]" /> roblox <span className="h-2 w-2 rounded-[2px] bg-[#7fd14f]" /> minecraft
          </p>
          <h1 className="mt-6 text-[50px] font-medium leading-[0.95] tracking-[-0.055em] sm:text-[76px] lg:text-[88px]">
            your imagination. their next favourite video.
          </h1>
          <p className="mt-6 max-w-[520px] text-[17.5px] leading-[1.75] text-fg-2">
            turn a random thought into a whole animated world — written, cast, animated, narrated and captioned for you. no animation skills, no editing.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Link href="/sign-up?next=/studio" className={primary}>
              start creating
            </Link>
            <Link href="#examples" className={secondary}>
              watch examples
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-fg-3">free to start · made for tiktok, reels and shorts</p>
        </div>
        <div className="relative mx-auto w-full max-w-[560px]" style={{ animation: "bob 6s ease-in-out infinite" }}>
          <Scene name="island" png alt="A floating voxel island with a house, trees and a character waving" className="w-full" />
        </div>
      </section>

      {/* The studio demo */}
      <section className="mx-auto max-w-[1080px] px-3 pb-10 sm:px-6">
        <div className="mb-4 flex items-center justify-between px-2">
          <p className="font-mono text-[12.5px] text-fg-3">a live demo · pick a story</p>
          <div className="flex gap-1.5" aria-hidden>
            {["#e63946", "#f5c518", "#3d7bf2"].map((c) => (
              <span key={c} className="h-2.5 w-5 rounded-[3px]" style={{ background: c }} />
            ))}
          </div>
        </div>
        <LiveDemo samples={samples} />
      </section>

      {/* One sentence, with characters hiding in bricks */}
      <section className="mx-auto max-w-[1060px] px-5 pb-20 pt-24 sm:px-6">
        <p className="text-[34px] font-medium leading-[1.25] tracking-[-0.04em] sm:text-[52px]">
          type one sentence <PopChip id="ch_milo" /> and get a story with a rule, a twist <PopChip id="ch_nova" /> and a cliffhanger — narrated, captioned and animated in a world <PopChip id="ch_bricks" /> built just for it.
        </p>
        <p className="mt-4 font-mono text-[12.5px] text-fg-3">psst — hover the bricks.</p>
      </section>

      {/* The idea, simply */}
      <section className="mx-auto max-w-[1060px] px-5 pb-24 sm:px-6">
        <div className="grid gap-6 border-y border-line-soft py-10 sm:grid-cols-3">
          {[
            ["a rule.", "one strange law the whole town lives by.", "#3d7bf2"],
            ["a reason to care.", "someone with something to lose.", "#f5c518"],
            ["a twist.", "the thing nobody saw coming.", "#e63946"],
          ].map(([t, d, c]) => (
            <div key={t} className="flex gap-4">
              <span className="mt-2 h-4 w-7 shrink-0 rounded-[3px]" style={{ background: c, boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)" }} />
              <div>
                <p className="text-[26px] font-medium tracking-[-0.035em]">{t}</p>
                <p className="mt-1 text-[15px] text-fg-2">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Built in — sideways scroll */}
      <section id="how-it-works" className="scroll-mt-10 pb-20">
        <HorizontalScroll
          header={
            <div className="mx-auto mb-10 flex w-full max-w-[1060px] items-end justify-between gap-6 px-5 sm:px-6">
              <h2 className={h2}>everything a story needs, built in.</h2>
              <p className="hidden max-w-[300px] text-[15px] text-fg-3 lg:block">keep scrolling →</p>
            </div>
          }
        >
          <article className={card}>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">every story gets a sheet</h3>
            <p className="mt-2 text-[15px] text-fg-2">the rule, why everyone obeys it, the secret behind it, the twist and the hook for next time.</p>
            {story?.story?.sheet && (
              <dl className={`mt-6 divide-y divide-line-soft text-[13.5px] ${inner}`}>
                {[["rule", story.story.sheet.rule], ["secret", story.story.sheet.secret], [`twist · ${story.story.sheet.twistType.replace(/_/g, " ")}`, story.story.sheet.twist]].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[86px_1fr] gap-2 px-4 py-2.5">
                    <dt className="font-mono text-[11.5px] leading-5 text-fg-3">{k}</dt>
                    <dd className="leading-5 text-fg-2">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
          <article className={card}>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">turn it into a series</h3>
            <p className="mt-2 text-[15px] text-fg-2">finish part 1, press one button. same world, same cast, a new twist.</p>
            <ul className={`mt-6 space-y-1 p-2 ${inner}`}>
              {samples.filter((x) => x.format === "mystery_series").slice(0, 3).map((x, k) => (
                <li key={x.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.thumb} alt="" className="h-12 w-[27px] rounded-[5px] object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{x.title.toLowerCase()}</span>
                    <span className="block truncate text-[12.5px] text-fg-3">{x.story?.sheet?.continuation.toLowerCase()}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${k === 0 ? "bg-[#d4f5a3] text-[#131316]" : "bg-bg-2 text-fg-2"}`}>{k === 0 ? "make part 2" : "part 1"}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className={card}>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">cast once, reuse forever</h3>
            <p className="mt-2 text-[15px] text-fg-2">same face, same outfit, every scene, both styles.</p>
            <div className={`mt-6 grid grid-cols-4 gap-2 p-3 ${inner}`}>
              {OFFICIAL_CHARACTERS.slice(0, 8).map((c) => (
                <span key={c.id} className="flex flex-col items-center rounded-[10px] bg-bg-2 pt-1">
                  <Portrait appearance={c.appearance} className="h-14 w-12" />
                  <span className="pb-1.5 text-[12px] font-medium">{c.name.toLowerCase()}</span>
                </span>
              ))}
            </div>
          </article>
          <article className={card}>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">a sound you’ll recognise</h3>
            <p className="mt-2 text-[15px] text-fg-2">the same opening sting, music that follows the story, and silence right before the twist.</p>
            <div className={`mt-6 p-4 ${inner}`} aria-hidden>
              <div className="flex h-24 items-end gap-[3px]">
                {Array.from({ length: 48 }, (_, k) => {
                  const twist = k >= 30 && k < 34;
                  const h = twist ? 3 : k === 34 ? 96 : 18 + Math.abs(Math.sin(k * 0.7)) * 45 + (k > 18 && k < 30 ? (k - 18) * 2.5 : 0);
                  return <span key={k} className="flex-1 rounded-[2px]" style={{ height: `${Math.min(96, h)}%`, background: k === 34 ? "#e63946" : twist ? "transparent" : "var(--fg-3)" }} />;
                })}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-fg-3">
                <span>hook</span>
                <span>escalation</span>
                <span className="text-[#e63946]">twist</span>
                <span>cliffhanger</span>
              </div>
            </div>
          </article>
          <article className={card}>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">know what works</h3>
            <p className="mt-2 text-[15px] text-fg-2">every script is checked against the editorial rules, then you see where people stop watching.</p>
            <ul className={`mt-6 space-y-2 p-4 text-[13.5px] ${inner}`}>
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
        </HorizontalScroll>
      </section>

      {/* Three formats */}
      <section className="mx-auto max-w-[1060px] px-5 pb-8 pt-16 sm:px-6">
        <h2 className={h2}>three ways to tell it.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {formatCards.map((c, i) => (
            <article key={c.t} className="group">
              <div className="relative overflow-hidden rounded-[22px]">
                <Scene name={c.img} night="card-night" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] text-[#131316]">{c.tag}</span>
                <div className="relative flex justify-center px-6 pt-12">
                  {c.s && (
                    <div className={`w-[150px] overflow-hidden rounded-t-[16px] border-[5px] border-b-0 border-[#131316] bg-black transition-transform duration-500 ease-[cubic-bezier(.3,1.4,.5,1)] group-hover:-translate-y-3 ${i === 1 ? "group-hover:rotate-0 rotate-[2deg]" : "group-hover:rotate-0 rotate-[-2deg]"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.s.thumb} alt={c.s.title} className="aspect-[9/12] w-full object-cover object-top" />
                    </div>
                  )}
                </div>
              </div>
              <h3 className="mt-5 text-[20px] font-semibold tracking-[-0.03em]">{c.t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-fg-2">{c.d}</p>
              {c.s && (
                <Link href={`/sign-up?next=${encodeURIComponent(`/studio?prompt=${encodeURIComponent(c.s.prompt)}&format=${c.s.format}`)}`} className="mt-3 inline-block text-[15px] font-semibold">
                  try “{c.s.title.toLowerCase()}” →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section id="examples" className="mx-auto max-w-[1200px] scroll-mt-10 px-5 pb-20 pt-24 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className={h2}>strange worlds. endless stories.</h2>
          <Link href="/explore" className={secondary}>
            explore more
          </Link>
        </div>
        <Examples samples={samples} />
      </section>

      {/* Brick by brick */}
      <section className="mx-auto max-w-[1060px] px-5 pb-12 pt-16 sm:px-6">
        <h2 className={`${h2} max-w-[760px]`}>built brick by brick, in about two minutes.</h2>
        <ol className="mt-14 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative">
              <div className="flex h-[110px] items-end" style={{ perspective: "600px" }} aria-hidden>
                <span className="relative flex flex-col-reverse" style={{ transform: "rotateX(-24deg) rotateY(30deg)", transformStyle: "preserve-3d" }}>
                  {STEPS.slice(0, i + 1).map((b) => (
                    <span key={b.t} className="block" style={{ height: 24, transformStyle: "preserve-3d" }}>
                      <Brick size={24} color={b.c} style={{ position: "relative" }} />
                    </span>
                  ))}
                </span>
              </div>
              <p className="mt-4 font-mono text-[12px] text-fg-3">step {i + 1}</p>
              <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">{s.t}</h3>
              <p className="mt-1 text-[15px] text-fg-2">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Cast */}
      <section className="mx-auto max-w-[1060px] px-5 pb-8 pt-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className={h2}>the same cast in every story.</h2>
          <p className="max-w-[420px] text-[17px] leading-[1.7] text-fg-2 md:justify-self-end">official characters, community creations and your own — each one looks the same in every scene, every style and every episode.</p>
        </div>
        <Link href="/characters" className="mt-10 block overflow-hidden rounded-[28px]">
          <Scene name="lineup" alt="The official cast: Milo, Juno, Bricks, Pixel, Sage, Rex, Nova, Dot and Odysseyyy" className="w-full" />
        </Link>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-[1060px] scroll-mt-10 px-5 pb-8 pt-24 sm:px-6">
        <h2 className={`${h2} mb-12 max-w-[900px]`}>start free. upgrade when it hits.</h2>
        <Pricing />
      </section>

      {/* FAQ */}
      <section id="questions" className="mx-auto grid max-w-[1060px] scroll-mt-10 gap-10 px-5 pb-28 pt-28 sm:px-6 md:grid-cols-[1fr_1.45fr]">
        <div>
          <h2 className={h2}>questions.</h2>
          <p className="mt-4 text-[15px] text-fg-2">
            something else? <Link href="/contact" className="font-semibold text-fg">get in touch</Link>.
          </p>
          <Portrait appearance={byId("ch_odysseyyy")} full pose="wave" className="mt-8 hidden h-48 w-40 md:block" />
        </div>
        <FAQ />
      </section>
    </div>
  );
}
