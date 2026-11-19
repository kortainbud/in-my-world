"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BUILDER, defaultAppearance, type CharacterRecord } from "@/lib/engine/characters";
import { ACCESSORIES, FACES, HAIR_STYLES, HATS, type Appearance, type VisualStyle } from "@/lib/engine/types";
import { api, ApiError } from "@/lib/client/api";
import { CharacterPreview } from "@/components/character-preview";
import { Button, Field, inputCls, Notice, Segmented, Spinner } from "@/components/ui";

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Swatches({ value, onChange, colors, name }: { value: string; onChange: (c: string) => void; colors: string[]; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-[7px] border-2 transition-transform hover:scale-105 ${value.toLowerCase() === c.toLowerCase() ? "border-fg" : "border-transparent"}`}
          style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}
        />
      ))}
    </div>
  );
}

function Chips<T extends string>({ value, onChange, options, name }: { value: T; onChange: (v: T) => void; options: readonly T[]; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`h-8 rounded-[7px] border px-2.5 text-caption transition-colors ${value === o ? "border-accent bg-[var(--accent-soft)] text-fg" : "border-line-soft text-fg-2 hover:border-line hover:text-fg"}`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function Builder({ id }: { id?: string }) {
  const router = useRouter();
  const [ap, setAp] = useState<Appearance>(defaultAppearance());
  const [preview, setPreview] = useState<VisualStyle>("roblox");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [reuse, setReuse] = useState<"owner_only" | "anyone">("owner_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    api<{ characters: (CharacterRecord & { isMine: boolean })[] }>("/api/characters?scope=mine").then((d) => {
      const c = d.characters.find((x) => x.id === id);
      if (!c) {
        setError("Character not found.");
        setLoaded(true);
        return;
      }
      setAp(c.appearance);
      setName(c.name);
      setDescription(c.description);
      setPersonality(c.personality);
      setVisibility(c.visibility);
      setReuse(c.reusePolicy === "anyone" ? "anyone" : "owner_only");
      if (c.style === "minecraft") setPreview("minecraft");
      setLoaded(true);
    });
  }, [id]);

  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setAp((a) => ({ ...a, [k]: v }));
  const randomize = () => {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
    setAp({
      skin: pick(BUILDER.skin), hair: pick(HAIR_STYLES), hairColor: pick(BUILDER.hairColors), top: pick(BUILDER.colors), topAccent: pick(BUILDER.colors),
      bottoms: pick(BUILDER.colors), shoes: pick(BUILDER.colors), hat: pick(HATS), hatColor: pick(BUILDER.colors), accessory: pick(ACCESSORIES),
      accessoryColor: pick(BUILDER.colors), face: pick(FACES), height: Math.round((0.9 + Math.random() * 0.25) * 100) / 100,
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { name, description, personality, style: "any", visibility, reusePolicy: visibility === "public" ? reuse : "owner_only", appearance: ap };
      if (id) await api(`/api/characters/${id}`, { method: "PATCH", json: payload });
      else await api("/api/characters", { method: "POST", json: payload });
      router.push("/studio/characters?tab=mine");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this character.");
      setBusy(false);
    }
  };

  if (!loaded) return <div className="flex min-h-[50vh] items-center justify-center text-small text-fg-3">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <Link href="/studio/characters" className="text-small text-fg-2 hover:text-fg">
        ← Characters
      </Link>
      <h1 className="mt-3 text-page font-semibold">{id ? `Edit ${name || "character"}` : "New character"}</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] border border-line bg-bg-2">
            <CharacterPreview appearance={ap} style={preview} className="absolute inset-0" />
            <div className="absolute left-3 top-3">
              <Segmented label="Preview style" value={preview} onChange={setPreview} options={[{ value: "roblox", label: "Roblox" }, { value: "minecraft", label: "Minecraft" }]} />
            </div>
            <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-micro text-fg-3">Drag to rotate · works in both styles</p>
          </div>
          <Button className="mt-3 w-full" onClick={randomize}>
            Randomize look
          </Button>
        </div>

        <div className="space-y-7">
          <section className="space-y-4">
            <Field label="Name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="e.g. Captain Toast" />
            </Field>
            <Field label="Description" hint="What they look like or do. Shown on the character card.">
              <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Personality" hint="Used by the story writer to keep them in character.">
              <textarea className={`${inputCls} !h-20 py-2`} value={personality} onChange={(e) => setPersonality(e.target.value)} maxLength={200} />
            </Field>
          </section>

          <Section title="Skin">
            <Swatches name="Skin tone" value={ap.skin} onChange={(v) => set("skin", v)} colors={BUILDER.skin} />
          </Section>
          <Section title="Hair">
            <Chips name="Hair style" value={ap.hair} onChange={(v) => set("hair", v)} options={HAIR_STYLES} />
            {ap.hair !== "none" && <Swatches name="Hair colour" value={ap.hairColor} onChange={(v) => set("hairColor", v)} colors={BUILDER.hairColors} />}
          </Section>
          <Section title="Face">
            <Chips name="Face" value={ap.face} onChange={(v) => set("face", v)} options={FACES} />
          </Section>
          <Section title="Top">
            <Swatches name="Top colour" value={ap.top} onChange={(v) => set("top", v)} colors={BUILDER.colors} />
            <p className="text-caption text-fg-3">Stripe & badge</p>
            <Swatches name="Accent colour" value={ap.topAccent} onChange={(v) => set("topAccent", v)} colors={BUILDER.colors} />
          </Section>
          <Section title="Bottoms & shoes">
            <Swatches name="Bottoms colour" value={ap.bottoms} onChange={(v) => set("bottoms", v)} colors={BUILDER.colors} />
            <Swatches name="Shoes colour" value={ap.shoes} onChange={(v) => set("shoes", v)} colors={BUILDER.colors} />
          </Section>
          <Section title="Hat">
            <Chips name="Hat" value={ap.hat} onChange={(v) => set("hat", v)} options={HATS} />
            {ap.hat !== "none" && <Swatches name="Hat colour" value={ap.hatColor} onChange={(v) => set("hatColor", v)} colors={BUILDER.colors} />}
          </Section>
          <Section title="Accessory">
            <Chips name="Accessory" value={ap.accessory} onChange={(v) => set("accessory", v)} options={ACCESSORIES} />
            {ap.accessory !== "none" && ap.accessory !== "shades" && <Swatches name="Accessory colour" value={ap.accessoryColor} onChange={(v) => set("accessoryColor", v)} colors={BUILDER.colors} />}
          </Section>
          <Section title="Height">
            <input type="range" min={0.85} max={1.2} step={0.01} value={ap.height} onChange={(e) => set("height", Number(e.target.value))} className="w-full max-w-sm accent-[#B9F36A]" aria-label="Height" />
          </Section>
          <Section title="Sharing">
            <Segmented label="Visibility" value={visibility} onChange={setVisibility} options={[{ value: "private", label: "Private" }, { value: "public", label: "Public" }]} />
            {visibility === "public" && (
              <Segmented label="Who can cast" value={reuse} onChange={setReuse} options={[{ value: "owner_only", label: "Only me" }, { value: "anyone", label: "Anyone can cast" }]} />
            )}
            <p className="text-caption text-fg-3">Public characters appear in the community library. Only you can edit them.</p>
          </Section>

          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex gap-2">
            <Button variant="primary" size="lg" onClick={save} disabled={busy || !name.trim()}>
              {busy && <Spinner />} {id ? "Save changes" : "Save character"}
            </Button>
            <Button size="lg" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-line-soft pt-5">
      <h2 className="text-small font-medium">{title}</h2>
      {children}
    </section>
  );
}
