import test from "node:test";
import assert from "node:assert/strict";
import { millisecondsToSeconds } from "./freshness";

test("millisecondsToSeconds rounds up partial seconds", () => {
  assert.strictEqual(millisecondsToSeconds(0), 0);
  assert.strictEqual(millisecondsToSeconds(1), 1);
  assert.strictEqual(millisecondsToSeconds(500), 1);
  assert.strictEqual(millisecondsToSeconds(999), 1);
  assert.strictEqual(millisecondsToSeconds(1000), 1);
  assert.strictEqual(millisecondsToSeconds(1001), 2);
  assert.strictEqual(millisecondsToSeconds(1500), 2);
  assert.strictEqual(millisecondsToSeconds(1999), 2);
  assert.strictEqual(millisecondsToSeconds(2000), 2);
  assert.strictEqual(millisecondsToSeconds(2001), 3);
});
