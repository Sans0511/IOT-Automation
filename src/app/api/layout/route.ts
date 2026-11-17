import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { getPublishedLayoutsByEmail } from "@/lib/published-layout";

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const requestedEmail =
    request.nextUrl.searchParams.get("email")?.trim() || user.email;

  if (
    user.role !== "ADMIN" &&
    requestedEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return forbiddenResponse("You can only view your own layout");
  }

  try {
    const result = await getPublishedLayoutsByEmail(requestedEmail);

    if (!result) {
      return notFoundResponse("User not found");
    }

    return NextResponse.json(result);
  } catch (error) {
    return serverErrorResponse("Load published layout", error);
  }
}
