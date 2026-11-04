import { beforeEach, describe, expect, it, vi } from "vitest";

const { openRouterCtor, instance } = vi.hoisted(() => {
  const instance = { callModel: vi.fn() };
  const openRouterCtor = vi.fn(function (this: unknown) {
    return instance;
  });

  return { openRouterCtor, instance };
});

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: openRouterCtor,
}));

beforeEach(() => {
  vi.resetModules();
  openRouterCtor.mockReset();
  openRouterCtor.mockImplementation(function (this: unknown) {
    return instance;
  });
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
});

describe("lib/ai/openrouter getOpenRouterClient", () => {
  it("fails with an internal error when the key is missing", async () => {
    const { getOpenRouterClient } = await import("@/lib/ai/openrouter");

    try {
      getOpenRouterClient();
      throw new Error("expected getOpenRouterClient to throw");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("INTERNAL_ERROR");
    }

    expect(openRouterCtor).not.toHaveBeenCalled();
  });

  it("creates the client once and reuses it", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const { getOpenRouterClient } = await import("@/lib/ai/openrouter");

    const first = getOpenRouterClient();
    const second = getOpenRouterClient();

    expect(first).toBe(instance);
    expect(second).toBe(instance);
    expect(openRouterCtor).toHaveBeenCalledTimes(1);
    expect(openRouterCtor).toHaveBeenCalledWith({ apiKey: "test-key" });
  });

  it("reads the key on first use rather than module load", async () => {
    const { getOpenRouterClient } = await import("@/lib/ai/openrouter");

    process.env.OPENROUTER_API_KEY = "late-key";

    expect(getOpenRouterClient()).toBe(instance);
    expect(openRouterCtor).toHaveBeenCalledWith({ apiKey: "late-key" });
  });
});

describe("lib/ai/openrouter getMessageModel", () => {
  it("defaults to the agreed message model", async () => {
    const { getMessageModel } = await import("@/lib/ai/openrouter");

    expect(getMessageModel()).toBe("openai/gpt-4.1-mini");
  });

  it("uses and trims the configured model", async () => {
    process.env.OPENROUTER_MODEL = "  anthropic/claude-test  ";
    const { getMessageModel } = await import("@/lib/ai/openrouter");

    expect(getMessageModel()).toBe("anthropic/claude-test");
  });

  it("falls back to the default for a blank override", async () => {
    process.env.OPENROUTER_MODEL = "   ";
    const { getMessageModel } = await import("@/lib/ai/openrouter");

    expect(getMessageModel()).toBe("openai/gpt-4.1-mini");
  });
});
