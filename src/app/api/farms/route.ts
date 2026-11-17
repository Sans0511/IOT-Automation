import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  readJsonBody,
  readTrimmedString,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const farms = await prisma.farm.findMany({
      where: user.role === "ADMIN" ? {} : { ownerId: user.id },
      include: { _count: { select: { devices: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ farms });
  } catch (error) {
    return serverErrorResponse("List farms", error);
  }
}

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const body = await readJsonBody(request);

  if (!body) {
    return badRequestResponse("A valid JSON body is required");
  }

  const name = readTrimmedString(body, "name");
  const location = readTrimmedString(body, "location");

  if (!name || !location) {
    return badRequestResponse("Farm name and location are required");
  }

  try {
    const farm = await prisma.farm.create({
      data: { name, location, ownerId: user.id },
    });

    return NextResponse.json({ farm }, { status: 201 });
  } catch (error) {
    return serverErrorResponse("Create farm", error);
  }
}
