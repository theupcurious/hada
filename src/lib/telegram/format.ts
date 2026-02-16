const SPECIAL_CHARS_REGEX = /[_*\[\]()~`>#+\-=|{}.!]/g;

export function markdownToTelegramMarkdownV2(markdown: string): string {
  if (!markdown) {
    return "";
  }

  const placeholders: string[] = [];
  let working = markdown;

  const reserve = (value: string): string => {
    const id = placeholders.push(value) - 1;
    return `@@TG${id}@@`;
  };

  // fenced code blocks
  working = working.replace(/```([\s\S]*?)```/g, (_, code: string) =>
    reserve(`\`\`\`${escapeCode(code)}\`\`\``),
  );

  // inline code
  working = working.replace(/`([^`]+)`/g, (_, code: string) =>
    reserve(`\`${escapeCode(code)}\``),
  );

  // links
  working = working.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label: string, url: string) =>
      reserve(`[${escapeMarkdownV2(label)}](${escapeMarkdownV2(url)})`),
  );

  // bold
  working = working.replace(/\*\*([^*]+)\*\*/g, (_, text: string) =>
    reserve(`*${escapeMarkdownV2(text)}*`),
  );

  // italic
  working = working.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, (_, prefix: string, text: string) =>
    `${prefix}${reserve(`_${escapeMarkdownV2(text)}_`)}`,
  );

  // strikethrough
  working = working.replace(/~~([^~]+)~~/g, (_, text: string) =>
    reserve(`~${escapeMarkdownV2(text)}~`),
  );

  working = escapeMarkdownV2(working);

  working = working.replace(/@@TG(\d+)@@/g, (_, index: string) => placeholders[Number(index)] || "");

  return working;
}

export function escapeMarkdownV2(value: string): string {
  return value.replace(SPECIAL_CHARS_REGEX, "\\$&");
}

function escapeCode(value: string): string {
  return value.replace(/`/g, "\\`");
}
