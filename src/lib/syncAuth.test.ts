import { afterEach, describe, expect, it } from "vitest";
import { checkSyncAuth } from "./syncAuth";

const ORIGINAL = process.env.SCHEDULER_SYNC_TOKEN;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SCHEDULER_SYNC_TOKEN;
  else process.env.SCHEDULER_SYNC_TOKEN = ORIGINAL;
});

describe("checkSyncAuth", () => {
  it("is disabled (503) when no token is configured", () => {
    delete process.env.SCHEDULER_SYNC_TOKEN;
    expect(checkSyncAuth("anything")).toEqual({
      ok: false,
      status: 503,
      error: "sync not configured",
    });
  });

  it("rejects a wrong token (401)", () => {
    process.env.SCHEDULER_SYNC_TOKEN = "right";
    expect(checkSyncAuth("wrong").status).toBe(401);
    expect(checkSyncAuth("wrong").ok).toBe(false);
  });

  it("rejects a missing token even when configured (401)", () => {
    process.env.SCHEDULER_SYNC_TOKEN = "right";
    expect(checkSyncAuth(null).status).toBe(401);
    expect(checkSyncAuth(undefined).status).toBe(401);
    // The empty string must not match either.
    expect(checkSyncAuth("").status).toBe(401);
  });

  it("accepts the exact configured token", () => {
    process.env.SCHEDULER_SYNC_TOKEN = "right";
    expect(checkSyncAuth("right")).toEqual({ ok: true, status: 200 });
  });
});
