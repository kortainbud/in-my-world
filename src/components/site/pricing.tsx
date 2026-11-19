import Link from "next/link";
import { CREDIT_PACKS, formatPrice, PLANS } from "@/config/plans";
import { CreditTable } from "@/components/credit-table";

const TOPS = ["/scenes/card-day.jpg", "/scenes/card-sunset.jpg", "/scenes/card-night.jpg"];

export function Pricing() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p, i) => (
          <div key={p.id} className="flex flex-col rounded-[24px] bg-bg-2 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={TOPS[i % TOPS.length]} alt="" className="h-[120px] w-full rounded-[16px] object-cover" />
            <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-5">
              <div className="flex items-center gap-2">
                <h3 className="text-[22px] font-semibold tracking-[-0.03em]">{p.name.toLowerCase()}</h3>
                {p.highlighted && <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] text-fg-2">most popular</span>}
              </div>
              <p className="mt-1 text-[15px] text-fg-2">{p.tagline.toLowerCase()}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-[44px] font-semibold leading-none tracking-[-0.05em]">{formatPrice(p.priceMonthlyCents)}</span>
                <span className="text-[14px] text-fg-2">a month</span>
              </p>
              <p className="mt-2 text-[14px] font-medium">{p.monthlyCredits} credits every month</p>
              <Link
                href={`/sign-up?next=${encodeURIComponent(p.id === "free" ? "/studio" : "/studio/billing")}`}
                className={`mt-5 inline-flex h-11 items-center justify-center rounded-full text-[15px] font-medium transition-colors ${p.highlighted ? "bg-fg text-white hover:bg-[#2c2c33]" : "bg-white text-fg hover:bg-[#fafaf8]"}`}
              >
                {p.id === "free" ? "start free" : `choose ${p.name.toLowerCase()}`}
              </Link>
              <ul className="mt-5 space-y-2 text-[14px] text-fg-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <svg width="14" height="14" viewBox="0 0 14 14" className="mt-[4px] shrink-0" aria-hidden><path d="M2.5 7.2l2.7 2.6 6.3-6.3" stroke="#131316" strokeWidth="1.8" fill="none" /></svg>
                    {f.toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-fg-3">
        prices are placeholder configuration and will be finalised before launch. one-off packs: {CREDIT_PACKS.map((c) => `${c.credits} credits for ${formatPrice(c.priceCents)}`).join(", ")}.
      </p>
      <div id="credits" className="mt-16 grid scroll-mt-24 gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h3 className="text-[28px] font-semibold tracking-[-0.04em]">how credits work.</h3>
          <dl className="mt-5 space-y-4 text-[15px]">
            <div>
              <dt className="font-semibold">monthly allowance</dt>
              <dd className="mt-1 text-fg-2">every plan includes credits that refresh each billing period. unused allowance doesn’t roll over.</dd>
            </div>
            <div>
              <dt className="font-semibold">generation credits</dt>
              <dd className="mt-1 text-fg-2">each video costs credits based on length, narration and export quality. you see the cost before you create, and failed videos are refunded.</dd>
            </div>
            <div>
              <dt className="font-semibold">length & quality</dt>
              <dd className="mt-1 text-fg-2">free makes 30-second, 720p videos with a small watermark. creator goes to 60s, pro to 90s, both at 1080p.</dd>
            </div>
          </dl>
        </div>
        <CreditTable />
      </div>
    </div>
  );
}

export const FAQS: { q: string; a: string }[] = [
  {
    q: "How does video generation work?",
    a: "You write one idea. A language model turns it into a short script broken into scenes, picks or designs the characters, and chooses environments, camera moves, actions and sound effects from our asset library. We record narration, compose music, time the captions to the voice, and render every frame with our 3D engine into an MP4.",
  },
  { q: "Which animation styles are supported?", a: "Two today: a smooth, blocky avatar style (Roblox-inspired) and a voxel, pixel-textured style (Minecraft-inspired). Both are rendered from original assets. More styles are planned." },
  { q: "Do I need animation or editing experience?", a: "No. Creation is fully automatic: there’s nothing to keyframe, cut or caption. Guided creation and advanced editing are coming later for people who want more control." },
  { q: "How long does a video take to generate?", a: "Usually a minute or two for a 30-second video. Writing the story and recording narration take seconds; rendering depends on length and quality. The progress screen shows each real step as it happens." },
  { q: "Can I download my videos?", a: "Yes. Every finished video downloads as a vertical H.264 MP4 with narration and captions, ready for TikTok, Reels and Shorts." },
  { q: "Can I reuse characters?", a: "Yes. Save characters from any story or build your own, then cast them in future videos. They keep the same look every time." },
  { q: "How do credits work?", a: "Each plan includes a monthly credit allowance. A video’s cost depends on its length, narration and export quality, and you see it before you create. If a generation fails, the credits are refunded automatically." },
  { q: "Do I own the videos I make?", a: "You own the videos you create, subject to our Terms and the rights of anyone else involved — for example, featured personalities are licensed for use inside the product. Final terms will be published before launch." },
  { q: "Do you accept crypto payments?", a: "Crypto payments are planned as a separate payment option alongside cards. You can already link a Phantom or MetaMask wallet to sign in — linking never moves funds, and we never ask for seed phrases or private keys." },
];

export function FAQ() {
  return (
    <div className="space-y-2.5">
      {FAQS.map((f) => (
        <details key={f.q} className="group rounded-[18px] bg-bg-2 px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold tracking-[-0.01em]">
            {f.q.toLowerCase()}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[17px] text-fg transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-2">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
