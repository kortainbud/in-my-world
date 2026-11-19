import { requireUser } from "@/lib/server/auth";
import { accountSnapshot } from "@/lib/server/credits";
import { findDocs, getMany } from "@/lib/server/data";
import { json, route } from "@/lib/server/http";
import type { GenerationJob, Project } from "@/lib/server/models";

export const GET = route(async () => {
  const user = await requireUser();
  const [snap, jobs] = await Promise.all([
    accountSnapshot(user.id),
    findDocs<GenerationJob>("jobs", (q) => q.eq("user_id", user.id).order("ts", { ascending: false }).limit(50)),
  ]);
  const projects = await getMany<Project>("projects", jobs.map((j) => j.projectId));
  const history = jobs.map((j) => ({ jobId: j.id, projectId: j.projectId, title: projects.get(j.projectId)?.title ?? "Deleted project", status: j.status, credits: j.creditCost, refunded: j.refunded, createdAt: j.createdAt }));
  return json({ ...snap, history });
});
