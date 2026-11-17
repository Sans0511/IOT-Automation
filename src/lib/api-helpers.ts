import { DeviceType } from "@prisma/client";
import { NextResponse } from "next/server";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export function readTrimmedString(
  body: Record<string, unknown>,
  key: string,
): string | null {
  const value = body[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isDeviceType(value: unknown): value is DeviceType {
  return (
    typeof value === "string" &&
    Object.values(DeviceType).includes(value as DeviceType)
  );
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFoundResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbiddenResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverErrorResponse(label: string, error: unknown) {
  console.error(`${label}:`, error);
  return NextResponse.json(
    { error: `Unable to complete ${label.toLowerCase()}` },
    { status: 500 },
  );
}
