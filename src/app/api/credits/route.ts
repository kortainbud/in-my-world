import { requireUser } from "@/lib/server/auth";
import { accountSnapshot } from "@/lib/server/credits";
import { read } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  const user = await requireUser();
  const snap = await accountSnapshot(user.id);
  const history = await read((db) =>
    db.jobs
      .filter((j) => j.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map((j) => ({ jobId: j.id, projectId: j.projectId, title: db.projects.find((p) => p.id === j.projectId)?.title ?? "Deleted project", status: j.status, credits: j.creditCost, refunded: j.refunded, createdAt: j.createdAt })),
  );
  return json({ ...snap, history });
});
