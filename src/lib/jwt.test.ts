import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_AUDIENCE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_AUDIENCE,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from "./jwt";

process.env.JWT_ACCESS_SECRET = "test-access-secret-for-node-tests-only";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-node-tests-only";

type Role = Parameters<typeof signAccessToken>[0]["role"];

test("an access token verifies with the access audience", () => {
  const token = signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    role: "ADMIN" as Role,
  });
  const payload = verifyToken<AccessTokenPayload>(
    token,
    process.env.JWT_ACCESS_SECRET,
    ACCESS_AUDIENCE,
    ACCESS_TOKEN_MAX_AGE_SECONDS,
  );

  assert.ok(payload);
  assert.strictEqual(payload.sub, "user-1");
  assert.strictEqual(payload.email, "user@example.com");
  assert.strictEqual(payload.type, "access");
});

test("a refresh token verifies with the refresh audience", () => {
  const token = signRefreshToken({
    sub: "user-1",
    familyId: "family-1",
  });
  const payload = verifyToken<RefreshTokenPayload>(
    token,
    process.env.JWT_REFRESH_SECRET,
    REFRESH_AUDIENCE,
    REFRESH_TOKEN_TTL_SECONDS,
  );

  assert.ok(payload);
  assert.strictEqual(payload.sub, "user-1");
  assert.strictEqual(payload.familyId, "family-1");
  assert.strictEqual(payload.type, "refresh");
});

test("verification returns null for a wrong audience", () => {
  const accessToken = signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    role: "USER" as Role,
  });
  const refreshToken = signRefreshToken({
    sub: "user-1",
    familyId: "family-1",
  });

  assert.strictEqual(
    verifyToken(
      accessToken,
      process.env.JWT_ACCESS_SECRET,
      REFRESH_AUDIENCE,
      ACCESS_TOKEN_MAX_AGE_SECONDS,
    ),
    null,
  );
  assert.strictEqual(
    verifyToken(
      refreshToken,
      process.env.JWT_REFRESH_SECRET,
      ACCESS_AUDIENCE,
      REFRESH_TOKEN_TTL_SECONDS,
    ),
    null,
  );
});
