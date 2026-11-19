import Link from "next/link";
import samplesJson from "@/data/samples.json";
import type { SampleEntry } from "@/lib/server/views";
import { TEMPLATES } from "@/config/site";
import { CharacterShowcase, Examples, HeroDemo, ProductDemo } from "@/components/site/home-client";
import { FAQ, Pricing } from "@/components/site/pricing";
import { btn } from "@/components/ui/btn";

const samples = samplesJson as SampleEntry[];

const FEATURES = [
  { t: "AI story generation", d: "A hook, an escalating middle and a twist ending — written for short-form, from a single sentence." },
  { t: "Two visual styles", d: "Smooth blocky avatars or voxel worlds with pixel textures. Same story, either look." },
  { t: "Consistent characters", d: "Faces, outfits and proportions stay identical across scenes and stories." },
  { t: "Automatic animation", d: "Walks, waves, jumps, growth spurts, dances — performed and blocked for you." },
  { t: "AI narration", d: "A natural voice-over timed scene by scene, plus character dialogue." },
  { t: "Automatic captions", d: "Big, word-by-word captions synced to the voice. Burned in, social-ready." },
  { t: "Cinematic environments", d: "Streets, parks, bedrooms, plazas, stages and more — with day, sunset and night." },
  { t: "Vertical export", d: "1080×1920 H.264 MP4 with music and sound effects. Post it straight away." },
  { t: "Character library", d: "Official characters, community creations and your own — ready to cast." },
  { t: "Community discovery", d: "Explore what people are making, remix prompts and find new characters." },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-[1240px] px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="eyebrow">Turn any idea into a whole world</p>
          <h1 className="display mt-5 text-[46px] sm:text-[76px] lg:text-[92px]">
            Your imagination.
            <br />
            <span className="text-fg-2">Their next favourite video.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[560px] text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">
            Create hilarious stories, strange realities and cinematic animated videos from a single idea. No animation skills. No editing. Just imagine it.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/sign-up?next=/studio" className={btn("primary", "lg", "min-w-[180px]")}>
              Start creating
            </Link>
            <Link href="#examples" className={btn("secondary", "lg", "min-w-[180px]")}>
              Watch examples
            </Link>
          </div>
          <p className="mt-4 text-[12.5px] text-fg-3">Free plan · no card · turn a random thought into a whole animated world</p>
        </div>
        <div className="mt-14">
          <HeroDemo samples={samples} />
        </div>
      </section>

      {/* Prompt tape */}
      <div className="overflow-hidden border-y border-line-soft bg-accent py-3 text-accent-ink" aria-hidden>
        <div className="flex w-max gap-10 whitespace-nowrap text-[15px] font-medium" style={{ animation: "marquee 60s linear infinite" }}>
          {[...TEMPLATES, ...TEMPLATES].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              {t.prompt}
              <span className="h-2 w-2 bg-accent-ink" />
            </span>
          ))}
        </div>
      </div>

      {/* Product demonstration */}
      <section id="how-it-works" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className="display text-[40px] sm:text-[56px]">
            One sentence in.
            <br />A whole world out.
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-fg-2 md:justify-self-end">
            Every step below is real output from one of the sample videos — the script, the cast, the scene stills and the finished MP4.
          </p>
        </div>
        <ProductDemo sample={samples.find((s) => s.story?.scenes.length) ?? samples[0]} />
        <ol className="mt-16 grid gap-px overflow-hidden rounded-[16px] border border-line-soft bg-line-soft sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Imagine it", "Type a rule, a what-if, a POV. One line is plenty."],
            ["Generate your story", "We write it, break it into scenes and cast it."],
            ["Watch your world come alive", "Animation, narration, music and captions — rendered for you."],
            ["Download and share", "A vertical MP4, ready for any feed."],
          ].map(([t, d], i) => (
            <li key={t} className="bg-bg p-6">
              <span className="font-mono text-[12px] text-accent">0{i + 1}</span>
              <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">{t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Examples */}
      <section id="examples" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 pb-24 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-[40px] sm:text-[56px]">Strange worlds. Endless stories.</h2>
          <Link href="/explore" className={btn("secondary", "md")}>
            Explore more
          </Link>
        </div>
        <Examples samples={samples} />
      </section>

      {/* Features */}
      <section id="features" className="border-t border-line-soft">
        <div className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6">
          <h2 className="display max-w-[760px] text-[40px] sm:text-[56px]">Everything a video needs. Nothing you have to do.</h2>
          <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f, i) => (
              <div key={f.t} className="border-t border-line-soft pt-4">
                <span className="font-mono text-[11px] text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.01em]">{f.t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Characters */}
      <section className="border-t border-line-soft">
        <div className="mx-auto max-w-[1240px] px-4 py-24 sm:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-[40px] sm:text-[56px]">
              Meet the cast.
              <br />
              <span className="text-fg-2">Then make your own.</span>
            </h2>
            <Link href="/characters" className={btn("secondary", "md")}>
              All characters
            </Link>
          </div>
          <CharacterShowcase />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line-soft">
        <div className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 sm:px-6">
          <h2 className="display mb-10 text-[40px] sm:text-[56px]">Start free. Scale when it hits.</h2>
          <Pricing />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line-soft">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="display text-[40px] sm:text-[56px]">Questions.</h2>
            <p className="mt-4 text-[14px] text-fg-2">
              Something else? <Link href="/contact" className="text-fg underline decoration-line underline-offset-4">Get in touch</Link>.
            </p>
          </div>
          <FAQ />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line-soft">
        <div className="mx-auto max-w-[1240px] px-4 py-28 text-center sm:px-6">
          <h2 className="display text-[48px] sm:text-[88px]">What happens in your world?</h2>
          <p className="mx-auto mt-5 max-w-md text-[16px] text-fg-2">Type one sentence. Get a video you can post today.</p>
          <Link href="/sign-up?next=/studio" className={btn("primary", "lg", "mt-8 min-w-[200px]")}>
            Create my world
          </Link>
        </div>
      </section>
    </>
  );
}
