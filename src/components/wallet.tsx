"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button, Notice, Spinner } from "@/components/ui";

type Sol = { isPhantom?: boolean; connect(): Promise<{ publicKey: { toString(): string } }>; signMessage(m: Uint8Array, enc?: string): Promise<{ signature: Uint8Array }> };
type Eth = { isMetaMask?: boolean; request(a: { method: string; params?: unknown[] }): Promise<unknown> };

function phantom(): Sol | undefined {
  const w = window as unknown as { phantom?: { solana?: Sol }; solana?: Sol };
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined);
}
function metamask(): Eth | undefined {
  return (window as unknown as { ethereum?: Eth }).ethereum;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes: Uint8Array) {
  const Z = BigInt(0), B256 = BigInt(256), B58N = BigInt(58);
  let n = Z;
  for (const b of bytes) n = n * B256 + BigInt(b);
  let s = "";
  while (n > Z) {
    s = B58[Number(n % B58N)] + s;
    n /= B58N;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}

/**
 * Wallet identity: sign in with, or link, a Phantom (Solana) or MetaMask (EVM)
 * wallet by signing a one-time message. Never requests transactions, seed
 * phrases or private keys.
 */
export function WalletButtons({ purpose, onDone }: { purpose: "signin" | "link"; onDone: () => void }) {
  const [avail, setAvail] = useState<{ phantom: boolean; metamask: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setAvail({ phantom: !!phantom(), metamask: !!metamask() }), []);

  const run = async (which: "phantom" | "metamask") => {
    setBusy(which);
    setError(null);
    try {
      let chain: "solana" | "evm";
      let address: string;
      if (which === "phantom") {
        const p = phantom()!;
        const r = await p.connect();
        chain = "solana";
        address = r.publicKey.toString();
      } else {
        const m = metamask()!;
        const accts = (await m.request({ method: "eth_requestAccounts" })) as string[];
        chain = "evm";
        address = accts[0];
      }
      const { nonce, message } = await api<{ nonce: string; message: string }>("/api/wallet/nonce", { method: "POST", json: { chain, address, purpose } });
      let signature: string;
      if (which === "phantom") {
        const r = await phantom()!.signMessage(new TextEncoder().encode(message), "utf8");
        signature = b58(r.signature);
      } else {
        signature = (await metamask()!.request({ method: "personal_sign", params: [message, address] })) as string;
      }
      await api("/api/wallet/verify", { method: "POST", json: { nonce, signature } });
      onDone();
    } catch (e) {
      const m = e instanceof ApiError ? e.message : e instanceof Error && /reject|denied|cancel/i.test(e.message) ? "You cancelled the request in your wallet." : "The wallet didn’t respond. Try again.";
      setError(m);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["phantom", "metamask"] as const).map((w) => {
          const has = avail?.[w];
          const label = w === "phantom" ? "Phantom" : "MetaMask";
          return has ? (
            <Button key={w} type="button" onClick={() => run(w)} disabled={!!busy}>
              {busy === w && <Spinner />} {label}
            </Button>
          ) : (
            <a
              key={w}
              href={w === "phantom" ? "https://phantom.com/download" : "https://metamask.io/download/"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-dashed border-line text-[13px] text-fg-3 hover:text-fg-2"
              title={`${label} isn't installed in this browser`}
            >
              Get {label}
            </a>
          );
        })}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
