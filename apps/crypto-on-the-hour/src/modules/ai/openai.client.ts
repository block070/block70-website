import OpenAI from "openai";
import { config } from "../../config.js";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required for generation");
  if (!_client) _client = new OpenAI({ apiKey: config.openaiApiKey });
  return _client;
}

export async function completeJson(system: string, user: string): Promise<string> {
  const client = getOpenAI();
  const res = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.55,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function completeText(system: string, user: string): Promise<string> {
  return completeJson(system, user);
}
