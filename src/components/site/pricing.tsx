import Link from "next/link";
import { CREDIT_PACKS, formatPrice, PLANS } from "@/config/plans";
import { CreditTable } from "@/components/credit-table";

export function Pricing() {
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`flex flex-col rounded-[16px] border bg-bg-2 p-6 ${p.highlighted ? "border-accent" : "border-line-soft"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold tracking-[-0.02em]">{p.name}</h3>
              {p.highlighted && <span className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-accent-ink">Popular</span>}
            </div>
            <p className="mt-1 text-[13.5px] text-fg-2">{p.tagline}</p>
            <p className="mt-6 text-[44px] font-semibold leading-none tracking-[-0.04em]">
              {formatPrice(p.priceMonthlyCents)}
              <span className="ml-1 text-[14px] font-normal tracking-normal text-fg-3">/month</span>
            </p>
            <p className="mt-2 text-[13px] text-fg">{p.monthlyCredits} credits every month</p>
            <ul className="mt-5 space-y-2 border-t border-line-soft pt-5 text-[13.5px] text-fg-2">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" className="mt-[3px] shrink-0" aria-hidden><path d="M2.5 7.2l2.7 2.6 6.3-6.3" stroke="#B9F36A" strokeWidth="1.8" fill="none" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/sign-up?next=${encodeURIComponent(p.id === "free" ? "/studio" : "/studio/billing")}`}
              className={`mt-6 inline-flex h-11 items-center justify-center rounded-[9px] text-[14px] font-medium transition-colors ${p.highlighted ? "bg-accent text-accent-ink hover:bg-[#c9f88a]" : "border border-line bg-bg-3 hover:border-[#444]"}`}
            >
              {p.id === "free" ? "Start free" : `Choose ${p.name}`}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-fg-3">
        Pricing shown is placeholder configuration ({CREDIT_PACKS.map((c) => `${c.credits} credits for ${formatPrice(c.priceCents)}`).join(", ")} one-off packs) and will be finalised before launch.
      </p>
      <div id="credits" className="mt-14 grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h3 className="text-[22px] font-semibold tracking-[-0.02em]">How credits work</h3>
          <dl className="mt-5 space-y-4 text-[14px]">
            <div>
              <dt className="text-fg">Monthly allowance</dt>
              <dd className="mt-1 text-fg-2">Every plan includes credits that refresh at the start of each billing period. Unused allowance doesn’t roll over.</dd>
            </div>
            <div>
              <dt className="text-fg">Generation credits</dt>
              <dd className="mt-1 text-fg-2">Each video costs credits based on length, narration and export quality. You see the exact cost before you create.</dd>
            </div>
            <div>
              <dt className="text-fg">Video length</dt>
              <dd className="mt-1 text-fg-2">Free makes 30-second videos. Creator goes up to 60 seconds, Pro up to 90.</dd>
            </div>
            <div>
              <dt className="text-fg">Export quality</dt>
              <dd className="mt-1 text-fg-2">Free exports 720×1280 with a small watermark. Paid plans export 1080×1920 with no watermark.</dd>
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
    <div className="divide-y divide-line-soft rounded-[16px] border border-line-soft">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
            {f.q}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-fg-2 transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-fg-2">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
