import { describe, expect, it } from "vitest";
import { parseWeekClipboard, serializeWeekClipboard } from "./weekClipboard";

describe("parseWeekClipboard", () => {
  it("round-trips a serialized clipboard", () => {
    const clip = { creatorId: "abc123", weekStart: "2026-07-13" };
    expect(parseWeekClipboard(serializeWeekClipboard(clip))).toEqual(clip);
  });

  it("returns null for a missing cookie", () => {
    expect(parseWeekClipboard(undefined)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseWeekClipboard("not json")).toBeNull();
    expect(parseWeekClipboard('"just a string"')).toBeNull();
  });

  it("returns null when fields are missing or empty", () => {
    expect(parseWeekClipboard(JSON.stringify({ creatorId: "", weekStart: "2026-07-13" }))).toBeNull();
    expect(parseWeekClipboard(JSON.stringify({ weekStart: "2026-07-13" }))).toBeNull();
    expect(parseWeekClipboard(JSON.stringify({ creatorId: "abc123" }))).toBeNull();
  });

  it("returns null when weekStart is not a Monday or not a date", () => {
    expect(parseWeekClipboard(JSON.stringify({ creatorId: "abc123", weekStart: "2026-07-15" }))).toBeNull();
    expect(parseWeekClipboard(JSON.stringify({ creatorId: "abc123", weekStart: "nope" }))).toBeNull();
  });
});
