// The chat model used by step 5 (answers) and by export, as a LangChain chat model.
// LangChain's own Gemini class calls the older generateContent API, which new API keys can't use,
// so GeminiChat talks to the Gemini Interactions API directly and plugs into LangChain chains (.invoke and .stream).
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { HttpError } from "../http.js";

export const CHAT_MODEL = "gemini-3.6-flash";

// How long Gemini reasons before writing: "minimal" | "low" | "medium" | "high".
// Measured on an invoice question: default ≈ 12–30 s, "minimal" ≈ 3.5 s, same answer.
// Answers are grounded in cited sources (and export values are checked word for word), so deep reasoning isn't needed.
// Raise to "low" if answers that compare many documents get worse.
const GENERATION_CONFIG = { thinking_level: "minimal" };

// Stall guard. Gemini Flash sometimes stalls for 30–80 s before its first word (measured, on Google's side).
// If no words arrive within STALL_TIMEOUT_MS, the request is cancelled and sent once to the steadier lite model.
// The same retry happens when Flash's daily limit is used up (429): the lite model has its own limit.
const STALL_TIMEOUT_MS = 12000;
export const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_TIMEOUT_MS = 30000;

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export class GeminiChat extends BaseChatModel {
  constructor(fields = {}) {
    super(fields);
    this.model = fields.model ?? CHAT_MODEL;
  }

  _llmType() {
    return "gemini-interactions";
  }

  // Used by chain.stream(): yields the answer piece by piece as Gemini writes it.
  async *_streamResponseChunks(messages, options, runManager) {
    for await (const event of streamChat(toInput(messages), { model: this.model })) {
      if (event.type !== "text") continue;
      yield new ChatGenerationChunk({ message: new AIMessageChunk({ content: event.text }), text: event.text });
      await runManager?.handleLLMNewToken(event.text);
    }
  }

  // Used by .invoke(): the whole answer at once.
  async _generate(messages) {
    let text = "";
    for await (const event of streamChat(toInput(messages), { model: this.model })) {
      if (event.type === "text") text += event.text;
    }
    return { generations: [{ message: new AIMessage(text), text }] };
  }
}

// The Interactions API takes one text input, so a conversation is written out with speaker labels.
function toInput(messages) {
  return messages
    .map((message) => {
      const type = message._getType();
      if (type === "human") return `User: ${message.content}`;
      if (type === "ai") return `Assistant: ${message.content}`;
      return message.content; // system instructions, as they are
    })
    .join("\n\n");
}

class StallError extends Error {}
class QuotaError extends Error {} // 429: the model's rate or daily limit is used up

const QUOTA_MESSAGE = "The AI's free daily limit is used up. Try again later, or switch to a paid Gemini API key.";

// Streams one answer with the stall guard.
// Yields { type: "thinking" } when the model starts reasoning and { type: "text", text } for each piece of the answer.
export async function* streamChat(input, { model = CHAT_MODEL, stallMs = STALL_TIMEOUT_MS, fallbackMs = FALLBACK_TIMEOUT_MS } = {}) {
  try {
    yield* streamOnce(input, model, stallMs);
  } catch (error) {
    if (!(error instanceof StallError || error instanceof QuotaError)) throw error;
    // Safe to retry: both happen before the first word, so nothing has been shown yet.
    console.warn(`${model} ${error instanceof StallError ? `sent no words in ${stallMs / 1000} s` : "is over its limit"}; retrying with ${FALLBACK_MODEL}`);
    try {
      yield* streamOnce(input, FALLBACK_MODEL, fallbackMs);
    } catch (fallbackError) {
      if (fallbackError instanceof StallError) throw new Error("The AI service is too slow right now.");
      if (fallbackError instanceof QuotaError) throw new HttpError(429, QUOTA_MESSAGE);
      throw fallbackError;
    }
  }
}

// One request. Throws StallError if no text arrives within stallMs.
async function* streamOnce(input, model, stallMs) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured.");

  const controller = new AbortController();
  const stallTimer = setTimeout(() => controller.abort(new StallError()), stallMs);
  try {
    // The key goes in a header, not the URL, so it never shows up in proxy or server logs.
    const res = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model, input, stream: true, generation_config: GENERATION_CONFIG }),
      signal: controller.signal,
    });
    if (res.status === 429) throw new QuotaError(`${model}: ${await res.text()}`);
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);

    // Server-sent events (step.start / step.delta / interaction.completed), each with a JSON "data:" line.
    const stepTypes = {}; // step index → "thought" | "model_output"
    for await (const event of readServerSentEvents(res.body)) {
      if (event.event_type === "step.start") {
        stepTypes[event.index] = event.step?.type;
        if (event.step?.type === "thought") yield { type: "thinking" };
      } else if (event.event_type === "step.delta" && stepTypes[event.index] === "model_output" && event.delta?.type === "text") {
        clearTimeout(stallTimer); // words are arriving: no more stall checks
        yield { type: "text", text: event.delta.text };
      } else if (event.event_type === "error" || event.error) {
        throw new Error(`Gemini stream error: ${JSON.stringify(event.error ?? event)}`);
      }
    }
  } catch (error) {
    if (controller.signal.reason instanceof StallError) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(stallTimer);
    controller.abort(); // stops the request if the reader left early (e.g. the user closed the page)
  }
}

async function* readServerSentEvents(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    const blocks = buffer.split("\n\n"); // events are separated by a blank line
    buffer = blocks.pop();
    for (const block of blocks) {
      const data = block.split("\n").find((line) => line.startsWith("data: "));
      if (data && data !== "data: [DONE]") yield JSON.parse(data.slice(6)); // "[DONE]" ends the stream and isn't JSON
    }
  }
}
