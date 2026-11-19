import crypto from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/server/auth";
import { getDoc, insertDoc, isUniqueViolation, mutateDoc, now } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import type { Project, ViewerStat } from "@/lib/server/models";
import { SAMPLES } from "@/lib/server/views";

const VIEWER_COOKIE = "imw_viewer";

/**
 * Playback events from In My World's players.
 *  play     — playback started (a replay counts as another play)
 *  progress — {delta} seconds watched since the last report, {position} current time
 *  ended    — reached the end
 *  share    — the share link was copied
 */
export const POST = route(async (req: Request) => {
  const b = await body(req);
  const targetId = String(b.target ?? "");
  const event = String(b.event ?? "");
  if (!targetId || !["play", "progress", "ended", "share"].includes(event)) return json({ ok: false }, 400);
  const jar = await cookies();
  let viewer = jar.get(VIEWER_COOKIE)?.value;
  if (!viewer) {
    viewer = crypto.randomBytes(12).toString("base64url");
    jar.set(VIEWER_COOKIE, viewer, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const user = await currentUser();
  const delta = Math.min(30, Math.max(0, Number(b.delta) || 0));
  const position = Math.max(0, Number(b.position) || 0);

  const project = await getDoc<Project>("projects", targetId);
  const isSample = SAMPLES.some((s) => s.id === targetId);
  if (!project && !isSample) return json({ ok: false });
  if (project && !(project.visibility === "public" && project.status === "completed") && project.userId !== user?.id) return json({ ok: false });
  if (event === "share") {
    if (project && project.userId === user?.id) await mutateDoc<Project>("projects", project.id, (p) => void (p.shares = (p.shares ?? 0) + 1));
    return json({ ok: true });
  }
  // A creator watching their own video isn't audience data.
  if (project && user && project.userId === user.id) return json({ ok: false });

  const id = `${targetId}|${viewer}`;
  const apply = (st: ViewerStat) => {
    if (event === "play") st.plays++;
    if (event === "progress") st.watched += delta;
    st.furthest = Math.max(st.furthest, position);
    if (st.furthest >= 3) st.reached3s = true;
    if (event === "ended") st.completed = true;
    st.lastAt = now();
  };
  const updated = await mutateDoc<ViewerStat>("viewer_stats", id, apply);
  if (!updated) {
    const st: ViewerStat = { targetId, viewer, plays: 0, watched: 0, furthest: 0, completed: false, reached3s: false, firstAt: now(), lastAt: now() };
    apply(st);
    try {
      await insertDoc("viewer_stats", id, st);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      await mutateDoc<ViewerStat>("viewer_stats", id, apply);
    }
  }
  return json({ ok: true });
});
