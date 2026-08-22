import { describe, expect, it } from "vitest";
import {
  detectMessageLocale,
  detectPreferredLocale,
  normalizeLocale,
  parseAcceptLanguage,
  resolveRequestLocale,
  resolveTurnLocale,
  toLocaleLanguageTag,
} from "@/lib/i18n";

describe("i18n locale helpers", () => {
  it("normalizes Chinese locale variants", () => {
    expect(normalizeLocale("zh")).toBe("zh");
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("zh-Hant")).toBe("zh");
  });

  it("detects Chinese as a preferred browser locale", () => {
    expect(detectPreferredLocale(["en-US", "zh-CN"])).toBe("zh");
    expect(detectPreferredLocale(["zh-TW", "en-US"])).toBe("zh");
  });

  it("orders Accept-Language tags by quality", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9,zh-CN;q=0.95")).toEqual([
      "en-US",
      "zh-CN",
      "en",
    ]);
    expect(parseAcceptLanguage("*")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });

  it("resolves a request locale from the cookie, then Accept-Language", () => {
    expect(resolveRequestLocale("ko", "zh-CN,zh;q=0.9")).toBe("ko");
    expect(resolveRequestLocale(undefined, "zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(resolveRequestLocale("", "ja-JP")).toBe("ja");
    expect(resolveRequestLocale(undefined, null)).toBe("en");
  });

  it("returns the correct language tag for Chinese", () => {
    expect(toLocaleLanguageTag("zh")).toBe("zh-CN");
  });

  it("detects the language of the current user message", () => {
    expect(detectMessageLocale("请帮我整理今天的行程。")).toBe("zh");
    expect(detectMessageLocale("오늘 일정 정리해줘")).toBe("ko");
    expect(detectMessageLocale("今日は予定を整理して")).toBe("ja");
    expect(detectMessageLocale("Please help me plan today.")).toBe("en");
  });

  it("overrides the saved locale when the current message is written in another language", () => {
    expect(resolveTurnLocale("请用中文回答", "en")).toEqual({
      locale: "zh",
      source: "message",
    });

    expect(resolveTurnLocale("Please answer in English", "zh")).toEqual({
      locale: "en",
      source: "message",
    });

    expect(resolveTurnLocale("需要把这个项目拆成几个阶段？", "zh")).toEqual({
      locale: "zh",
      source: "settings",
    });
  });
});
