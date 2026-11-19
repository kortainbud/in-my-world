import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { createGeneration, validateInput } from "@/lib/server/pipeline";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = validateInput(await body(req));
  const { project, job, duplicate } = await createGeneration(user, input);
  return json({ projectId: project.id, jobId: job.id, duplicate }, duplicate ? 200 : 201);
});
