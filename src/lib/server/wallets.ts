import "server-only";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { verifyMessage } from "viem";

export function walletMessage(opts: { address: string; purpose: "link" | "signin"; nonce: string; origin: string }) {
  return [
    `In My World wants you to ${opts.purpose === "link" ? "link this wallet to your account" : "sign in with this wallet"}.`,
    "",
    "This signature only proves you own the wallet. It does not authorise any transaction or cost anything.",
    "",
    `Wallet: ${opts.address}`,
    `Site: ${opts.origin}`,
    `Nonce: ${opts.nonce}`,
  ].join("\n");
}

export function validAddress(chain: string, address: string) {
  if (chain === "evm") return /^0x[0-9a-fA-F]{40}$/.test(address);
  if (chain === "solana") {
    try {
      return bs58.decode(address).length === 32;
    } catch {
      return false;
    }
  }
  return false;
}

export async function verifyWalletSignature(chain: "solana" | "evm", address: string, message: string, signature: string) {
  try {
    if (chain === "solana") {
      return nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), bs58.decode(address));
    }
    return await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
  } catch {
    return false;
  }
}
