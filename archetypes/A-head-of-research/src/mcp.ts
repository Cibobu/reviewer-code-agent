import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { InputSchema } from "./contract.js";
import { handle } from "./handler.js";

const TOOL_NAME = "scan_pull_request";

export function buildMcpServer(): Server {
  const server = new Server(
    { name: "foru-archetype-a-pr-risk-scanner", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Scan a GitHub PR for bugs, security risks, missing tests, and merge impact.",
        inputSchema: {
          type: "object",
          properties: {
            prUrl: { type: "string", description: "GitHub PR URL" },
            githubToken: {
              type: "string",
              description: "Optional PAT for private repos",
            },
          },
          required: ["prUrl"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== TOOL_NAME) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }

    const parsed = InputSchema.safeParse(req.params.arguments);
    if (!parsed.success) {
      return {
        content: [
          { type: "text", text: `Invalid input: ${parsed.error.message}` },
        ],
        isError: true,
      };
    }

    const output = await handle(parsed.data);
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  });

  return server;
}
