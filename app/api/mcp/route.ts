import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import { createMcpServer } from "@/lib/mcp-server";
import { authenticateRequest } from "@/lib/mcp-auth";

/**
 * POST /api/mcp  — Receive JSON-RPC messages from MCP clients.
 * GET  /api/mcp  — Open an SSE stream for server-initiated notifications.
 * DELETE /api/mcp — Close a session.
 *
 * This is the Streamable HTTP transport endpoint, allowing any MCP-compatible
 * client to connect to this application directly over HTTP without running a
 * separate stdio process.
 *
 * Configure your MCP client with:
 *   URL:    https://your-app.com/api/mcp
 *   Header: x-mcp-api-key: <MCP_API_KEY>
 */

async function handleMcp(req: NextRequest): Promise<Response> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — one session per request
  });

  const server = createMcpServer();
  await server.connect(transport);

  // NextRequest extends the Web Standard Request, so this is type-safe.
  return transport.handleRequest(req);
}

export const POST = handleMcp;
export const GET = handleMcp;
export const DELETE = handleMcp;
