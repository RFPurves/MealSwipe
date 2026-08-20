import { describe, expect, it } from "vitest";
import { normalizeUsername, validateUsername } from "@/lib/usernames";

describe("usernames", () => {
  it("normalizes handles without exposing email identifiers", () => {
    expect(normalizeUsername("  @Rab.Purves ")).toBe("rab.purves");
  });

  it.each(["ab", "_rab", "rab_", "rab..purves", "rab purves", "rab@example.com"])("rejects invalid username %s", (value) => {
    expect(validateUsername(value).error).toBeTruthy();
  });

  it("accepts a stable unique-handle shape", () => {
    expect(validateUsername("rab_purves")).toEqual({ username: "rab_purves", error: null });
  });
});
