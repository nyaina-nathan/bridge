import { describe, expect, it } from "vitest";

import { cx } from "@/lib/utils/cx";

describe("cx", () => {
  it("joins truthy class names with a single space", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });

  it("drops false, null and undefined values", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("drops empty strings", () => {
    expect(cx("", "a", "")).toBe("a");
  });

  it("returns an empty string when nothing is provided", () => {
    expect(cx()).toBe("");
    expect(cx(false, null, undefined)).toBe("");
  });
});
