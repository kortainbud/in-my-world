-- Card (Stripe) and crypto (Solana USDC/SOL) payments.
alter table payments
  drop constraint if exists payments_status_check;
alter type payment_status add value if not exists 'expired';
alter table payments
  add column crypto jsonb,               -- {token, amount (base units), decimals, mint, receiver, reference, cluster, expiresAt, usdRate}
  add column fulfilled_at timestamptz,
  add constraint payments_provider_check check (provider in ('stripe', 'solana'));
-- A Solana reference key or Stripe session can only ever fulfil one payment.
create unique index payments_reference_once on payments ((crypto ->> 'reference')) where crypto is not null;
