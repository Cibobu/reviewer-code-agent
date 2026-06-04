import "dotenv/config";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../../../docs/rule.ts";
import { buildToolResultsBlock, runLocalTools } from "./tools.js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env: ${name}. Copy .env.example to .env and fill values.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const apiKey = requireEnv("NINEROUTER_API_KEY");
  const baseURL = requireEnv("NINEROUTER_BASE_URL");
  const model = requireEnv("NINEROUTER_MODEL");

  const toolReport = runLocalTools();
  const toolResults = buildToolResultsBlock(toolReport);

  const client = new OpenAI({ apiKey, baseURL });

  const userMessage = [
    "Review the following code-change context from local tools.",
    "Prioritize security, bugs, missing validation, weak error handling, and missing tests.",
    "Never repeat or quote raw secrets; reference file/line only.",
    "If tests were skipped, do not claim they passed.",
    "",
    toolResults,
  ].join("\n");

  console.error("Running PR Risk Scanner Agent…\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    console.error("Model returned empty response.");
    process.exit(1);
  }

  console.log(content);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
