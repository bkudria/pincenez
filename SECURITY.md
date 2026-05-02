# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub's [private vulnerability reporting](https://github.com/bkudria/pincenez/security/advisories/new).

Do **not** open a public issue for security reports. We will acknowledge receipt within 7 days and aim to respond with a fix or mitigation timeline within 30 days.

## Supported versions

Pincenez is pre-1.0 and under active development. Only the latest published version on npm receives security fixes.

## Privacy & data flow

Pincenez is a CLI grader that calls the Anthropic API via [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk). Be aware of what is sent off your machine:

- **Sent to Anthropic**: the contents of your checks YAML file (including any `context` field) and the contents of the output file or stdin you are grading. Each check is one API call.
- **Not sent anywhere else**: pincenez has no telemetry, no analytics, and no remote logging. Results go to stdout only.
- **Stored locally**: nothing persistent. The grader runs `query()` with Read-only tool access; the LLM cannot write to your filesystem.
- **Credentials**: `ANTHROPIC_API_KEY` is read from your environment by the SDK. Pincenez never logs it.

If your checks file or graded output contains sensitive data, treat each `pincenez` invocation as transmitting that data to Anthropic. Review [Anthropic's data usage policies](https://www.anthropic.com/legal) before grading sensitive content.
