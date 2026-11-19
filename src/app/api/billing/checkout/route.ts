import { HttpError, requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { findItem, paymentMethods } from "@/lib/server/payments";
import { createStripeCheckout } from "@/lib/server/stripe";

export const GET = route(async () => json(paymentMethods()));

/** Card checkout (Stripe) for a plan or a credit pack. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const item = findItem(String(b.kind), String(b.itemId));
  if (!item) throw new HttpError(400, "Unknown plan or credit pack.");
  const url = await createStripeCheckout(user, item, new URL(req.url).origin);
  return json({ url });
});
