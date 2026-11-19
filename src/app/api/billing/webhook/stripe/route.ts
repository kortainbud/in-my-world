import { json, route } from "@/lib/server/http";
import { handleStripeWebhook } from "@/lib/server/stripe";

/** Stripe → us. Verified by signature; the raw body is required for that. */
export const POST = route(async (req: Request) => {
  const res = await handleStripeWebhook(await req.text(), req.headers.get("stripe-signature"));
  return json({ received: true, ...res });
});
