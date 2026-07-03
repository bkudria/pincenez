import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { UsageError } from './errors.js';

export const AUTH_MODES = ['auto', 'subscription', 'api-key'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

type Env = Record<string, string | undefined>;

export function parseAuthMode(value: string): AuthMode {
  if ((AUTH_MODES as readonly string[]).includes(value)) {
    return value as AuthMode;
  }
  throw new UsageError(`invalid --auth mode "${value}" (expected auto, subscription, or api-key)`);
}

/**
 * Best-effort check for Claude subscription (Claude Code OAuth) credentials:
 * an explicit CLAUDE_SDK_OAUTH_TOKEN, the Claude Code credentials file, or
 * the macOS Keychain entry Claude Code writes on login.
 * CLAUDE_CODE_OAUTH_TOKEN deliberately does not count — pincenez never
 * forwards it (see buildSdkEnv), so it is not usable evidence.
 */
export function detectSubscriptionCredentials(
  env: Env = process.env,
  platform: string = process.platform,
): boolean {
  if (env.CLAUDE_SDK_OAUTH_TOKEN?.trim()) {
    return true;
  }

  const configDir = env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const credentialsPath = join(configDir, '.credentials.json');
  if (existsSync(credentialsPath)) {
    try {
      const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
      if (credentials.claudeAiOauth != null) {
        return true;
      }
    } catch {
      // Unreadable or unparseable file — fall through to the next source.
    }
  }

  if (platform === 'darwin') {
    try {
      execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials'], {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Build the env for the Agent SDK subprocess under the given auth mode.
 * The SDK subprocess prefers ANTHROPIC_API_KEY over stored OAuth credentials,
 * so preferring the subscription means withholding the API-key variables.
 * CLAUDECODE is always unset to avoid nested-session failures.
 *
 * An inherited CLAUDE_CODE_OAUTH_TOKEN is always stripped: the Claude Code
 * runtime lets that variable override a /login credential, and an export
 * meant for other tooling must not silently hijack pincenez runs. To hand
 * pincenez a token explicitly, set CLAUDE_SDK_OAUTH_TOKEN — it is mapped onto
 * CLAUDE_CODE_OAUTH_TOKEN (the only name the runtime reads) and wins over
 * /login credentials.
 */
export function buildSdkEnv(
  mode: AuthMode,
  env: Env = process.env,
  platform: string = process.platform,
): Env {
  const sdkToken = env.CLAUDE_SDK_OAUTH_TOKEN?.trim();
  const base: Env = {
    ...env,
    CLAUDECODE: undefined,
    CLAUDE_SDK_OAUTH_TOKEN: undefined,
    CLAUDE_CODE_OAUTH_TOKEN: sdkToken || undefined,
  };

  if (mode === 'api-key') {
    if (!env.ANTHROPIC_API_KEY?.trim()) {
      throw new UsageError('--auth api-key requires ANTHROPIC_API_KEY to be set');
    }
    return { ...base, CLAUDE_CODE_OAUTH_TOKEN: undefined };
  }

  const hasApiCredentials = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);

  if (
    env.CLAUDE_CODE_OAUTH_TOKEN?.trim() &&
    !sdkToken &&
    !hasApiCredentials &&
    !detectSubscriptionCredentials(env, platform)
  ) {
    throw new UsageError(
      'CLAUDE_CODE_OAUTH_TOKEN is set but pincenez does not use it, and no other ' +
        'credential is available. Set CLAUDE_SDK_OAUTH_TOKEN, log in with `claude /login`, ' +
        'or set ANTHROPIC_API_KEY.',
    );
  }
  const preferSubscription =
    mode === 'subscription' || (hasApiCredentials && detectSubscriptionCredentials(env, platform));

  if (preferSubscription) {
    return { ...base, ANTHROPIC_API_KEY: undefined, ANTHROPIC_AUTH_TOKEN: undefined };
  }

  return base;
}
