// Turns "[1]" or "[1, 3]" in an answer into "#cite-n" Markdown links, which the chat renders as clickable chips.
// Numbers without a matching source stay plain text; "[1](…)" is already a link and is left alone.
export function linkCitations(text, sourceCount) {
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (match, list) => {
    const numbers = list.split(",").map((number) => Number(number.trim()));
    if (numbers.some((number) => number < 1 || number > sourceCount)) return match;
    return numbers.map((number) => `[${number}](#cite-${number})`).join(" ");
  });
}
