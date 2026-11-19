import { currentUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { libraryFor } from "@/lib/server/pipeline";
import { exploreItems } from "@/lib/server/explore";
import { TEMPLATES } from "@/config/site";

export const GET = route(async (req: Request) => {
  const u = new URL(req.url);
  const style = u.searchParams.get("style") ?? "all";
  const category = u.searchParams.get("category") ?? "all";
  const sort = u.searchParams.get("sort") ?? "trending";
  const q = (u.searchParams.get("q") ?? "").trim().toLowerCase();
  const user = await currentUser();
  const [all, library] = await Promise.all([exploreItems(), libraryFor(user?.id ?? null)]);
  let items = [...all];
  if (style !== "all") items = items.filter((i) => i.style === style);
  if (category !== "all") items = items.filter((i) => i.category === category);
  if (q) items = items.filter((i) => i.title.toLowerCase().includes(q) || i.prompt.toLowerCase().includes(q));
  const age = (d: string) => (Date.now() - new Date(d).getTime()) / 36e5;
  if (sort === "recent") items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (sort === "popular") items.sort((a, b) => b.views - a.views || b.createdAt.localeCompare(a.createdAt));
  else items.sort((a, b) => b.views / Math.pow(age(b.createdAt) + 2, 1.2) - a.views / Math.pow(age(a.createdAt) + 2, 1.2) || b.createdAt.localeCompare(a.createdAt));

  const creators = new Map<string, { handle: string; displayName: string; videos: number; views: number; isSample: boolean }>();
  for (const i of all) {
    const c = creators.get(i.owner.handle) ?? { ...i.owner, videos: 0, views: 0, isSample: i.isSample };
    c.videos++;
    c.views += i.views;
    creators.set(i.owner.handle, c);
  }
  const characters = library
    .filter((c) => c.visibility === "public")
    .sort((a, b) => b.uses - a.uses || Number(b.featured) - Number(a.featured))
    .slice(0, 8);
  return json({
    items,
    creators: [...creators.values()].sort((a, b) => b.views - a.views || b.videos - a.videos).slice(0, 6),
    characters,
    prompts: TEMPLATES.slice(0, 6),
    total: all.length,
  });
});
