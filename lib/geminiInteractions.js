import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";

const INTERACTIONS_URL =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

// The legacy generateContent API (used by @langchain/google-genai) is
// retired for new API keys. Text generation now goes through the Gemini
// Interactions API. This class plugs that API into LangChain chat chains.
export class GeminiInteractionsChat extends BaseChatModel {
    constructor(fields = {}) {
        super(fields);
        this.model = fields.model ?? "gemini-3.6-flash";
        this.apiKey = fields.apiKey ?? process.env.GOOGLE_API_KEY;
    }

    _llmType() {
        return "gemini-interactions";
    }

    async _generate(messages) {
        const input = messages.map((m) => m.content).join("\n");

        const body = { model: this.model, input };

        const res = await fetch(`${INTERACTIONS_URL}?key=${this.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Gemini API error ${res.status}: ${text}`);
        }

        const data = await res.json();
        const outputStep = data.steps?.find((s) => s.type === "model_output");
        const text = (outputStep?.content ?? [])
            .map((c) => c.text ?? "")
            .join("");

        return { generations: [{ message: new AIMessage(text), text }] };
    }
}
