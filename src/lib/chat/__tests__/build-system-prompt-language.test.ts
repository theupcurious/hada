import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";

describe("buildSystemPrompt language guidance", () => {
  it("keeps Chinese as a first-class saved locale", async () => {
    const prompt = await buildSystemPrompt({
      supabase: createSupabaseStub({ locale: "zh" }),
      userId: "user-1",
      source: "web",
      tools: [],
      connectedIntegrations: [],
      userMessage: "继续用中文",
    });

    expect(prompt.responseLocale).toBe("zh");
    expect(prompt.responseLocaleSource).toBe("settings");
    expect(prompt.prompt).toContain("Default response language from user settings: Chinese.");
    expect(prompt.prompt).toContain("Current turn response language: Chinese.");
  });

  it("overrides the saved locale when the latest message is in Chinese", async () => {
    const prompt = await buildSystemPrompt({
      supabase: createSupabaseStub({ locale: "en" }),
      userId: "user-1",
      source: "web",
      tools: [],
      connectedIntegrations: [],
      userMessage: "请帮我总结一下这次会议。",
    });

    expect(prompt.responseLocale).toBe("zh");
    expect(prompt.responseLocaleSource).toBe("message");
    expect(prompt.prompt).toContain("Current turn override: reply in Chinese");
  });
});

function createSupabaseStub(settings: { locale?: string }) {
  const stub = {
    from(table: string) {
      if (table === "users") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: {
                      name: "Test User",
                      email: "test@example.com",
                      tier: "free",
                      settings,
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "user_memories") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order: async () => ({
                        data: [],
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "integrations") {
        return {
          select() {
            return {
              eq: async () => ({
                data: [],
                error: null,
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table in test stub: ${table}`);
    },
  };

  return stub as unknown as Parameters<typeof buildSystemPrompt>[0]["supabase"];
}
