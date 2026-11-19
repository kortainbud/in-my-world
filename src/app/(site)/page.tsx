import Link from "next/link";
import samplesJson from "@/data/samples.json";
import type { SampleEntry } from "@/lib/server/views";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { TEMPLATES } from "@/config/site";
import { Examples } from "@/components/site/home-client";
import { LiveDemo } from "@/components/site/live-demo";
import { FAQ, Pricing } from "@/components/site/pricing";
import { Portrait } from "@/components/portrait";

const samples = samplesJson as SampleEntry[];
const byId = (id: string) => OFFICIAL_CHARACTERS.find((c) => c.id === id)!.appearance;

const black = "inline-flex h-12 items-center justify-center rounded-full bg-fg px-6 text-[16px] font-medium text-white transition-colors hover:bg-[#2c2c33]";
const grey = "inline-flex h-12 items-center justify-center rounded-full bg-bg-2 px-6 text-[16px] font-medium text-fg transition-colors hover:bg-bg-3";
const white = "inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[16px] font-medium text-fg transition-colors hover:bg-[#f5f5f3]";
const h2 = "text-[40px] font-medium leading-[1.03] tracking-[-0.045em] sm:text-[56px]";

function Chip({ id }: { id: string }) {
  return (
    <span className="mx-1 inline-flex h-[0.95em] w-[0.85em] translate-y-[0.12em] items-end justify-center overflow-hidden rounded-[0.18em] bg-[#d9f2ff] align-baseline">
      <Portrait appearance={byId(id)} className="h-[0.95em] w-[0.85em]" />
    </span>
  );
}

const RULES = [
  { id: "ch_milo", t: "strange world", d: "one strange rule runs a whole town. someone breaks it, and everything follows." },
  { id: "ch_juno", t: "mystery series", d: "every episode reveals one piece. finish one, then make part 2 with the same cast." },
  { id: "ch_sage", t: "impossible choice", d: "two options, both with a cost. the video ends on the choice, right on screen." },
  { id: "ch_rex", t: "one real twist", d: "identity, betrayal, rule reversal, consequence, perspective or loop. never all of them at once." },
  { id: "ch_nova", t: "a signature sound", d: "the same opening sting, music that follows the story, silence right before the twist." },
  { id: "ch_dot", t: "characters that stay put", d: "same face, same outfit, same proportions, every scene and every episode." },
];

const STEPS = [
  { n: "1", t: "type one sentence", d: "a rule, a what-if, a pov. one line is enough.", bar: "bg-[#a6e1fc]" },
  { n: "2", t: "pick a format", d: "strange world, mystery series or impossible choice.", bar: "bg-[#fff1a8]" },
  { n: "3", t: "cast it", d: "use the official cast, your own characters, or let us choose.", bar: "bg-[#ffc6dc]" },
  { n: "4", t: "post it", d: "a narrated, captioned vertical mp4 in about two minutes.", bar: "bg-[#d4f5a3]" },
];

export default function Home() {
  const story = samples.find((s) => s.story?.sheet) ?? samples[0];
  const formatCards = [
    { img: "/scenes/card-day.jpg", s: samples.find((x) => x.format === "strange_world"), t: "a strange world", d: "one rule, one town, one person who breaks it. made to be shared." },
    { img: "/scenes/card-night.jpg", s: samples.find((x) => x.format === "mystery_series"), t: "a mystery series", d: "every episode answers one question and opens a bigger one." },
    { img: "/scenes/card-sunset.jpg", s: samples.find((x) => x.format === "impossible_choice"), t: "an impossible choice", d: "two doors, both with a price. let the comments decide." },
  ];
  return (
    <>
      {/* Hero */}
      <section className="px-5 pb-16 pt-10 text-center sm:px-6 sm:pt-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-bg-2 px-3 py-1 text-[13px] font-medium text-fg-2">
          two styles <span className="h-1 w-1 rounded-full bg-fg-3" /> roblox <span className="h-1 w-1 rounded-full bg-fg-3" /> minecraft
        </p>
        <h1 className="mx-auto mt-6 max-w-[1200px] text-[50px] font-medium leading-[0.95] tracking-[-0.055em] sm:text-[80px] lg:text-[96px]">
          your imagination.
          <br />
          their next <Chip id="ch_pixel" /> favourite video.
        </h1>
        <p className="mx-auto mt-7 max-w-[640px] text-[17.5px] leading-[1.85] text-fg-2">
          turn a random thought into a whole animated world. create hilarious stories, strange realities and cinematic videos from a single idea — no animation skills, no editing.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/sign-up?next=/studio" className={black}>
            start creating
          </Link>
          <Link href="#examples" className={grey}>
            watch examples
          </Link>
        </div>
        <p className="mt-4 text-[14px] font-medium text-fg-2">free to start. no card, no editing.</p>
      </section>

      {/* Framed live demo */}
      <section className="px-3 sm:px-6">
        <div className="relative mx-auto max-w-[1340px] overflow-hidden rounded-[28px] bg-[#3fb6f5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scenes/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <p className="absolute right-5 top-4 z-10 hidden font-mono text-[12.5px] text-white/90 sm:block">a live demo. click around.</p>
          <div className="relative mx-auto max-w-[1080px] px-3 pb-10 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
            <LiveDemo samples={samples} />
          </div>
        </div>
      </section>

      {/* Made for */}
      <section className="mx-auto flex max-w-[1060px] flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-12 text-[16px] font-medium sm:justify-between">
        <span className="text-fg-2">made for</span>
        {["tiktok", "reels", "shorts", "youtube", "your group chat"].map((x) => (
          <span key={x}>{x}</span>
        ))}
        <span className="text-fg-2">as a vertical mp4</span>
      </section>

      {/* Big sentence */}
      <section className="mx-auto max-w-[1060px] px-5 pb-24 pt-16 sm:px-6">
        <p className="text-[34px] font-medium leading-[1.12] tracking-[-0.04em] sm:text-[52px]">
          type one sentence <Chip id="ch_milo" /> and get a story with a rule, a twist <Chip id="ch_nova" /> and a cliffhanger — narrated, captioned and animated in a world <Chip id="ch_bricks" /> built just for it.
        </p>
      </section>

      {/* Every story needs a rule */}
      <section className="px-3 sm:px-6">
        <div className="relative mx-auto max-w-[1060px] overflow-hidden rounded-[28px] bg-[#2f8ef0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scenes/ocean.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative px-4 pb-36 pt-14 sm:px-14 sm:pb-52">
            <div className="rounded-[22px] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,40,90,0.5)] sm:p-9">
              <h2 className={h2}>every story needs a rule.</h2>
              <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-fg-2">a reason to care, something that threatens it, and a twist that changes everything. that’s the whole system.</p>
              <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {RULES.map((r) => (
                  <div key={r.t} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-end justify-center overflow-hidden rounded-[9px] bg-[#e8f4fd]">
                      <Portrait appearance={byId(r.id)} className="h-9 w-8" />
                    </span>
                    <span>
                      <span className="block text-[16px] font-semibold tracking-[-0.01em]">{r.t}</span>
                      <span className="mt-0.5 block text-[14.5px] leading-snug text-fg-2">{r.d}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built in */}
      <section id="how-it-works" className="mx-auto max-w-[1060px] scroll-mt-10 px-5 pb-8 pt-28 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className={h2}>everything a story needs, built in.</h2>
          <p className="max-w-[420px] text-[17px] leading-[1.7] text-fg-2 md:justify-self-end">every video comes with its story sheet, an editorial check, its cast and its numbers — so the next one is better.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] bg-bg-2 p-6 sm:p-7">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">every story gets a sheet</h3>
            <p className="mt-2 text-[15px] text-fg-2">the premise, the rule, why everyone obeys it, the secret behind it, the twist and the hook for next time.</p>
            {story?.story?.sheet && (
              <dl className="mt-6 divide-y divide-[#ececea] rounded-[16px] bg-white text-[13.5px]">
                {[["premise", story.story.sheet.premise], ["rule", story.story.sheet.rule], ["secret", story.story.sheet.secret], [`twist · ${story.story.sheet.twistType.replace(/_/g, " ")}`, story.story.sheet.twist]].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[96px_1fr] gap-2 px-4 py-2.5">
                    <dt className="font-mono text-[11.5px] leading-5 text-fg-3">{k}</dt>
                    <dd className="leading-5 text-fg-2">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
          <article className="rounded-[24px] bg-bg-2 p-6 sm:p-7">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">turn it into a series</h3>
            <p className="mt-2 text-[15px] text-fg-2">finish part 1, press one button. same world, same cast, a new twist, and a reason to come back.</p>
            <ul className="mt-6 space-y-1.5 rounded-[16px] bg-white p-2">
              {samples.filter((x) => x.format === "mystery_series").slice(0, 3).map((x, k) => (
                <li key={x.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-[#f7f7f5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.thumb} alt="" className="h-12 w-[27px] rounded-[5px] object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{x.title.toLowerCase()}</span>
                    <span className="block truncate text-[12.5px] text-fg-3">{x.story?.sheet?.continuation.toLowerCase()}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${k === 0 ? "bg-[#d4f5a3]" : "bg-[#f0f0ec] text-fg-2"}`}>{k === 0 ? "make part 2" : "part 1"}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-[24px] bg-bg-2 p-6 sm:p-7">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">cast once, reuse forever</h3>
            <p className="mt-2 text-[15px] text-fg-2">characters keep their look in both styles. build your own or cast the official crew.</p>
            <div className="mt-6 grid grid-cols-4 gap-2 rounded-[16px] bg-white p-3">
              {OFFICIAL_CHARACTERS.slice(0, 8).map((c) => (
                <span key={c.id} className="flex flex-col items-center rounded-[10px] bg-[#f7f7f5] pt-1">
                  <Portrait appearance={c.appearance} className="h-16 w-14" />
                  <span className="pb-1.5 text-[12px] font-medium">{c.name.toLowerCase()}</span>
                </span>
              ))}
            </div>
          </article>
          <article className="rounded-[24px] bg-bg-2 p-6 sm:p-7">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em]">know what works</h3>
            <p className="mt-2 text-[15px] text-fg-2">check every script against the editorial rules, then see where people stop watching.</p>
            <div className="mt-6 rounded-[16px] bg-white p-4">
              <ul className="space-y-2 text-[13.5px]">
                {["starts with an interesting premise", "the conflict escalates rather than repeats", "the twist changes what you understood", "the ending opens a real question"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#28c840] text-white">
                      <svg width="8" height="8" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#ececea] pt-3 text-center">
                {["3-second retention", "completion", "rewatches"].map((x) => (
                  <span key={x} className="rounded-[10px] bg-[#f7f7f5] px-2 py-2">
                    <span className="block font-mono text-[11px] text-fg-3">{x}</span>
                    <span className="mt-0.5 block text-[12px] font-medium text-fg-2">measured</span>
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Three formats */}
      <section className="mx-auto max-w-[1060px] px-5 pb-8 pt-24 sm:px-6">
        <h2 className={h2}>three ways to tell it.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {formatCards.map((c) => (
            <article key={c.t}>
              <div className="relative overflow-hidden rounded-[20px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="relative flex justify-center px-6 pb-0 pt-10">
                  {c.s && (
                    <div className="w-[150px] overflow-hidden rounded-t-[14px] border-[4px] border-b-0 border-[#131316] bg-black">
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
      <section id="examples" className="mx-auto max-w-[1200px] scroll-mt-10 px-5 pb-24 pt-24 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className={h2}>strange worlds. endless stories.</h2>
          <Link href="/explore" className={grey}>
            explore more
          </Link>
        </div>
        <Examples samples={samples} />
      </section>

      {/* Tape */}
      <div className="-rotate-1 overflow-hidden bg-[#cdbcff] py-3.5" aria-hidden>
        <div className="flex w-max gap-10 whitespace-nowrap text-[17px] font-medium" style={{ animation: "marquee 70s linear infinite" }}>
          {[...TEMPLATES, ...TEMPLATES].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              {t.prompt.toLowerCase()}
              <span className="h-2.5 w-2.5 bg-[#131316]" />
            </span>
          ))}
        </div>
      </div>

      {/* Steps */}
      <section className="mx-auto max-w-[1060px] px-5 pb-8 pt-28 sm:px-6">
        <h2 className={`${h2} max-w-[720px]`}>from one sentence to a finished video in about two minutes.</h2>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col overflow-hidden rounded-[22px] bg-bg-2">
              <div className="flex-1 p-5">
                <span className="text-[44px] font-medium leading-none tracking-[-0.05em]">{s.n}</span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em]">{s.t}</h3>
                <p className="mt-1.5 text-[14.5px] leading-snug text-fg-2">{s.d}</p>
              </div>
              <span className={`h-2 ${s.bar}`} />
            </div>
          ))}
        </div>
      </section>

      {/* Cast */}
      <section className="mx-auto max-w-[1060px] px-5 pb-8 pt-24 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className={h2}>the same cast in every story.</h2>
          <p className="max-w-[420px] text-[17px] leading-[1.7] text-fg-2 md:justify-self-end">official characters, community creations and your own — each one looks the same in every scene, every style and every episode.</p>
        </div>
        <Link href="/characters" className="mt-10 block overflow-hidden rounded-[28px] bg-[#3fb6f5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scenes/lineup.jpg" alt="The official cast: Milo, Juno, Bricks, Pixel, Sage, Rex, Nova, Dot and Odysseyyy" className="w-full" />
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

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#3fb6f5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/scenes/cta.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative px-5 pb-48 pt-28 text-center sm:pb-64">
          <h2 className="text-[48px] font-medium leading-[0.95] tracking-[-0.055em] text-white [text-shadow:0_2px_20px_rgba(0,60,120,0.25)] sm:text-[88px]">what happens in your world?</h2>
          <p className="mx-auto mt-5 max-w-md text-[18px] font-medium text-white/95">type one sentence. post a video today.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href="/sign-up?next=/studio" className={black}>
              create my world
            </Link>
            <Link href="/explore" className={white}>
              explore stories
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
