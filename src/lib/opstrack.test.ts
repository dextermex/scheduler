import { describe, expect, it } from "vitest";
import { linkedLabel, normalizeCreatorMap } from "./opstrack";

describe("normalizeCreatorMap", () => {
  it("parses the object account shape", () => {
    const map = normalizeCreatorMap({
      creators: [
        {
          id: "c1",
          name: "Chloe",
          accounts: [
            { id: "acct_vip", username: "chloevip", name: "Chloe VIP" },
            { id: "acct_free", username: null, name: null },
          ],
        },
      ],
    });
    expect(map.c1).toEqual([
      { id: "acct_vip", username: "chloevip", name: "Chloe VIP" },
      { id: "acct_free", username: null, name: null },
    ]);
  });

  it("still accepts the legacy plain-string account shape", () => {
    const map = normalizeCreatorMap({ creators: [{ id: "c1", accounts: ["acct_a", "acct_b"] }] });
    expect(map.c1?.map((a) => a.id)).toEqual(["acct_a", "acct_b"]);
  });

  it("tolerates garbage without throwing", () => {
    expect(normalizeCreatorMap(null)).toEqual({});
    expect(normalizeCreatorMap({})).toEqual({});
    expect(normalizeCreatorMap({ creators: [{ id: "", accounts: ["x"] }, { accounts: 7 }, null] })).toEqual({});
    expect(normalizeCreatorMap({ creators: [{ id: "c", accounts: [42, "", null, { id: "" }] }] })).toEqual({ c: [] });
  });
});

describe("linkedLabel", () => {
  const map = normalizeCreatorMap({
    creators: [
      { id: "both", accounts: [{ id: "a", username: "vip" }, { id: "b", username: "free" }] },
      { id: "anon", accounts: [{ id: "a", username: "vip" }, { id: "b" }] },
      { id: "one", accounts: [{ id: "a" }] },
    ],
  });
  it("joins handles when all are known", () => {
    expect(linkedLabel(map, "both")).toBe("@vip + @free");
  });
  it("falls back to a page count when any handle is unknown", () => {
    expect(linkedLabel(map, "anon")).toBe("2 pages");
    expect(linkedLabel(map, "one")).toBe("1 page");
  });
  it("is empty for unlinked creators", () => {
    expect(linkedLabel(map, "nope")).toBe("");
  });
});
