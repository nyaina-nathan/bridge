import { describe, expect, it } from "vitest";

import { buildMessageSystemPrompt } from "@/lib/prompts/message.prompts";
import {
  messageOutputFormat,
  messageSafetyNotice,
  messageSystemPrompt,
} from "@/lib/prompts/message.prompts";
import { buildPartnerViewSystemPrompt } from "@/lib/prompts/partner-view.prompts";
import {
  partnerViewOutputFormat,
  partnerViewSystemPrompt,
} from "@/lib/prompts/partner-view.prompts";
import { buildSummarySystemPrompt } from "@/lib/prompts/summary.prompts";
import {
  summaryOutputFormat,
  summarySystemPrompt,
} from "@/lib/prompts/summary.prompts";

describe("message prompt", () => {
  it("fills every placeholder", () => {
    const prompt = buildMessageSystemPrompt({
      stage: "problem_explaining",
      participantName: "Ada",
      otherName: "Grace",
    });

    expect(prompt).toContain("Current stage: problem_explaining");
    expect(prompt).toContain("private conversation with Ada");
    expect(prompt).toContain("Their partner is not here");
    expect(prompt).not.toContain("{{stage}}");
    expect(prompt).not.toContain("{{participantName}}");
    expect(prompt).not.toContain("{{otherName}}");
  });

  it("appends the machine-readable output format", () => {
    const prompt = buildMessageSystemPrompt({
      stage: "problem_explaining",
      participantName: "Ada",
      otherName: "Grace",
    });

    expect(prompt.endsWith(messageOutputFormat)).toBe(true);
    expect(prompt).toContain('"readyToSummarize"');
    expect(prompt).toContain('"safetyFlag"');
  });

  it("does not interpret replacement patterns in names", () => {
    // A function replacer keeps `$&` literal; the string form would inject the
    // matched placeholder instead.
    const prompt = buildMessageSystemPrompt({
      stage: "collecting",
      participantName: "$& Grace",
      otherName: "Grace",
    });

    expect(prompt).toContain("private conversation with $& Grace");
    expect(prompt).toContain("$& Grace feel truly understood");
    expect(prompt).not.toContain("{{participantName}}");
  });

  it("exports a safety notice for flagged replies", () => {
    expect(messageSafetyNotice.length).toBeGreaterThan(0);
    expect(messageSafetyNotice).toMatch(/safety/i);
  });

  it("keeps the raw template placeholders", () => {
    expect(messageSystemPrompt).toContain("{{participantName}}");
    expect(messageSystemPrompt).toContain("{{stage}}");
  });
});

describe("summary prompt", () => {
  it("fills the participant name and appends the output format", () => {
    const prompt = buildSummarySystemPrompt({ participantName: "Ada" });

    expect(prompt).toContain("You write a first-person summary of Ada's side");
    expect(prompt).not.toContain("{{participantName}}");
    expect(prompt.endsWith(summaryOutputFormat)).toBe(true);
    expect(prompt).toContain('"summary"');
  });

  it("keeps the raw template placeholder", () => {
    expect(summarySystemPrompt).toContain("{{participantName}}");
  });
});

describe("partner view prompt", () => {
  it("fills the participant name and appends the output format", () => {
    const prompt = buildPartnerViewSystemPrompt({ participantName: "Ada" });

    expect(prompt).toContain("You rewrite Ada's private");
    expect(prompt).not.toContain("{{participantName}}");
    expect(prompt.endsWith(partnerViewOutputFormat)).toBe(true);
    expect(prompt).toContain('"partnerView"');
  });

  it("keeps the raw template placeholder", () => {
    expect(partnerViewSystemPrompt).toContain("{{participantName}}");
  });
});
