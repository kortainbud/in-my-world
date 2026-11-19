import { requireUser } from "@/lib/server/auth";
import { findDocs } from "@/lib/server/data";
import { json, route } from "@/lib/server/http";
import type { Project } from "@/lib/server/models";
import { projectViews } from "@/lib/server/views";

const GROUPS: Record<string, string[]> = {
  processing: ["queued", "processing", "awaiting_render", "rendering"],
  completed: ["completed"],
  failed: ["failed"],
};

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const status = new URL(req.url).searchParams.get("status") ?? "all";
  const mine = await findDocs<Project>("projects", (q) => q.eq("user_id", user.id).order("ts", { ascending: false }).limit(500));
  const counts = {
    all: mine.length,
    processing: mine.filter((p) => GROUPS.processing.includes(p.status)).length,
    completed: mine.filter((p) => p.status === "completed").length,
    failed: mine.filter((p) => p.status === "failed").length,
  };
  const list = status === "all" ? mine : mine.filter((p) => GROUPS[status]?.includes(p.status));
  return json({ projects: await projectViews(list), counts });
});
