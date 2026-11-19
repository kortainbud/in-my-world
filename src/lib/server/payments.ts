import "server-only";
import { PROVIDERS } from "./config";
import type { User } from "./models";

/**
 * Payment provider abstraction. Card processors and crypto payment processors
 * are independent providers behind the same interface; neither is wired up
 * yet. Credits and plan changes are only ever applied from a provider's
 * server-side verification (webhook), never from a client-side success state.
 */
export interface CheckoutItem {
  kind: "subscription" | "credits";
  id: string;
  amountCents: number;
  credits: number;
}

export interface PaymentProvider {
  id: string;
  label: string;
  method: "card" | "crypto";
  createCheckout(user: User, item: CheckoutItem, returnUrl: string): Promise<{ url: string; providerRef: string }>;
  /** Verifies a webhook and returns the settled payment, or null if the event is irrelevant. */
  verifyWebhook(req: Request): Promise<{ providerRef: string; status: "succeeded" | "failed" } | null>;
}

const registry: Record<string, PaymentProvider> = {
  // e.g. stripe: stripeProvider, coinbase: coinbaseCommerceProvider — add implementations here.
};

export function paymentProviders(): PaymentProvider[] {
  return PROVIDERS.payments === "none" ? [] : PROVIDERS.payments.split(",").map((p) => registry[p.trim()]).filter(Boolean);
}

export function paymentProvider(id: string): PaymentProvider | undefined {
  return paymentProviders().find((p) => p.id === id);
}
