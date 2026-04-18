import type { SDKResultError } from "@anthropic-ai/claude-agent-sdk";

export function formatSdkError(
  err: Pick<SDKResultError, "subtype" | "errors" | "terminal_reason" | "permission_denials">,
): string {
  const detail = err.errors.length > 0 ? err.errors.join("; ") : "no error details provided";
  const terminal = err.terminal_reason ? ` (terminal: ${err.terminal_reason})` : "";
  const denied = err.permission_denials.length > 0
    ? `; denied tools: ${err.permission_denials.map((d) => d.tool_name).join(", ")}`
    : "";
  return `SDK result ${err.subtype}${terminal}: ${detail}${denied}`;
}
