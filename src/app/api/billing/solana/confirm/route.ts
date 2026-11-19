import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { confirmSolanaPayment } from "@/lib/server/solana";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  return json(await confirmSolanaPayment(user, String(b.paymentId), typeof b.signature === "string" ? b.signature : undefined));
});
