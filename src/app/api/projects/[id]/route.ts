import { currentUser, HttpError, requireUser } from "@/lib/server/auth";
import { read, tx, now } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { deleteProject, resumePending } from "@/lib/server/pipeline";
import { projectView } from "@/lib/server/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await currentUser();
  await resumePending();
  const view = await read((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (!p) return null;
    const isOwner = user?.id === p.userId;
    if (!isOwner && !(p.visibility === "public" && p.status === "completed")) return null;
    return { project: projectView(db, p, { withJob: isOwner }), isOwner };
  });
  if (!view) throw new HttpError(404, "This video doesn't exist or is private.");
  return json(view);
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const view = await tx((db) => {
    const p = db.projects.find((x) => x.id === id && x.userId === user.id);
    if (!p) throw new HttpError(404, "Project not found.");
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
    return projectView(db, p, { withJob: true });
  });
  return json({ project: view });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  await deleteProject(user, id);
  return json({ ok: true });
});
