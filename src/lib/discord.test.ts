import { describe, expect, it } from "vitest";
import { chunkMessage, composeOnShiftMessage } from "./discord";
import { parseCell } from "./seedData";

describe("composeOnShiftMessage", () => {
  it("lists one line per chatter with models and discord username", () => {
    const msg = composeOnShiftMessage([
      { models: ["Chloe"], chatter: "Marie", discordUsername: "marie_dc" },
      { models: ["Lillie"], chatter: "Damien", discordUsername: "damien99" },
    ]);
    expect(msg).toBe("ON SHIFT :\n\nCHLOE - Marie - @marie_dc\nLILLIE - Damien - @damien99");
  });

  it("groups a chatter's models on one line", () => {
    const msg = composeOnShiftMessage([
      { models: ["Chloe", "Jade", "Aubrey"], chatter: "Koki", discordUsername: "koki_dc" },
    ]);
    expect(msg).toBe("ON SHIFT :\n\nCHLOE, JADE, AUBREY - Koki - @koki_dc");
  });

  it("omits the username segment when none is on file and strips a pasted @", () => {
    const msg = composeOnShiftMessage([
      { models: ["Lillie"], chatter: "Milz", discordUsername: "" },
      { models: ["Riley"], chatter: "Sofiane", discordUsername: "@sofi" },
    ]);
    expect(msg).toBe("ON SHIFT :\n\nLILLIE - Milz\nRILEY - Sofiane - @sofi");
  });

  it("renders a numeric Discord user ID as a clickable mention", () => {
    const msg = composeOnShiftMessage([
      { models: ["Chloe"], chatter: "Koki", discordUsername: "218301356918177792" },
    ]);
    expect(msg).toBe("ON SHIFT :\n\nCHLOE - Koki - <@218301356918177792>");
  });

  it("skips entries with no models", () => {
    const msg = composeOnShiftMessage([
      { models: [], chatter: "Ghost", discordUsername: "" },
      { models: ["Jade"], chatter: "Helena", discordUsername: "" },
    ]);
    expect(msg).toBe("ON SHIFT :\n\nJADE - Helena");
  });
});

describe("chunkMessage", () => {
  it("returns one chunk for short messages", () => {
    expect(chunkMessage("hello")).toEqual(["hello"]);
  });

  it("splits on line boundaries under the limit", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `LINE ${i} ${"x".repeat(50)}`);
    const chunks = chunkMessage(lines.join("\n"), 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(500);
    expect(chunks.join("\n")).toBe(lines.join("\n"));
  });
});

describe("parseCell", () => {
  it("splits shared slots", () => {
    expect(parseCell("Alex + Sam")).toEqual(["Alex", "Sam"]);
    expect(parseCell("Marie")).toEqual(["Marie"]);
  });

  it("drops TBD and empties", () => {
    expect(parseCell("")).toEqual([]);
    expect(parseCell("TBD")).toEqual([]);
  });
});
