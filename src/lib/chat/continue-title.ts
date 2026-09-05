interface ConversationEntry { role: string; content: string; }
export function continueTitle(messages: ConversationEntry[], fallback: string): string {
  const meaningful = [...messages].reverse().find((message) => message.role === "user" &&
    !/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|안녕(?:하세요)?|こんにちは|你好)[\s!?.]*$/i.test(message.content.trim()));
  return meaningful?.content.replace(/\s+/g, " ").trim().slice(0, 80) || fallback;
}
