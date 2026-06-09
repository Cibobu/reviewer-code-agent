import { InputSchema, OutputSchema } from "./contract.js";
import { brain } from "./brain.js";

export async function handle(rawInput: unknown): Promise<unknown> {
  const input = InputSchema.parse(rawInput);
  const output = await brain(input);
  return OutputSchema.parse(output);
}

export default handle;
