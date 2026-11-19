import { requireUser } from "@/lib/server/auth";
import { read } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { resumePending } from "@/lib/server/pipeline";
import { projectView } from "@/lib/server/views";

const GROUPS: Record<string, string[]> = {
  processing: ["queued", "processing", "awaiting_render", "rendering"],
  completed: ["completed"],
  failed: ["failed"],
};

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  await resumePending();
  const status = new URL(req.url).searchParams.get("status") ?? "all";
  const data = await read((db) => {
    const mine = db.projects.filter((p) => p.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const counts = {
      all: mine.length,
      processing: mine.filter((p) => GROUPS.processing.includes(p.status)).length,
      completed: mine.filter((p) => p.status === "completed").length,
      failed: mine.filter((p) => p.status === "failed").length,
    };
    const list = status === "all" ? mine : mine.filter((p) => GROUPS[status]?.includes(p.status));
    return { projects: list.map((p) => projectView(db, p)), counts };
  });
  return json(data);
});
