import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
  console.error("[api]", e);
  return json({ error: "Something went wrong on our side. Please try again." }, 500);
}

export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}
