import { currentUser, HttpError, requireUser } from "@/lib/server/auth";
import { getDoc, mutateDoc, now } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import type { Project } from "@/lib/server/models";
import { deleteProject } from "@/lib/server/pipeline";
import { projectView } from "@/lib/server/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await currentUser();
  const p = await getDoc<Project>("projects", id);
  const isOwner = !!p && user?.id === p.userId;
  if (!p || (!isOwner && !(p.visibility === "public" && p.status === "completed"))) throw new HttpError(404, "This video doesn't exist or is private.");
  return json({ project: await projectView(p, { withJob: isOwner }), isOwner });
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const p = await mutateDoc<Project>("projects", id, (p) => {
    if (p.userId !== user.id) throw new HttpError(404, "Project not found.");
    if (b.visibility !== undefined) {
      if (b.visibility !== "public" && b.visibility !== "private") throw new HttpError(400, "Invalid visibility.");
      if (b.visibility === "public" && p.status !== "completed") throw new HttpError(409, "Only finished videos can be shared.");
      p.visibility = b.visibility;
    }
    if (typeof b.title === "string") {
      const t = b.title.trim().slice(0, 80);
      if (!t) throw new HttpError(400, "Title can't be empty.");
      p.title = t;
    }
    p.updatedAt = now();
  });
  if (!p) throw new HttpError(404, "Project not found.");
  return json({ project: await projectView(p, { withJob: true }) });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  await deleteProject(user, id);
  return json({ ok: true });
});
