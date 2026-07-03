import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseAuthMode, detectSubscriptionCredentials, buildSdkEnv } from '../src/auth.js';
import { UsageError } from '../src/errors.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/user'),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockExecFileSync.mockImplementation(() => {
    throw new Error('not found');
  });
});

describe('parseAuthMode', () => {
  it.each(['auto', 'subscription', 'api-key'] as const)('accepts %s', (mode) => {
    expect(parseAuthMode(mode)).toBe(mode);
  });

  it('rejects unknown modes with a UsageError naming the valid values', () => {
    expect(() => parseAuthMode('oauth')).toThrow(UsageError);
    expect(() => parseAuthMode('oauth')).toThrow(/auto, subscription, or api-key/);
  });
});

describe('detectSubscriptionCredentials', () => {
  it('returns true when CLAUDE_SDK_OAUTH_TOKEN is set', () => {
    expect(detectSubscriptionCredentials({ CLAUDE_SDK_OAUTH_TOKEN: 'tok' }, 'linux')).toBe(true);
    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('ignores a whitespace-only CLAUDE_SDK_OAUTH_TOKEN', () => {
    expect(detectSubscriptionCredentials({ CLAUDE_SDK_OAUTH_TOKEN: '   ' }, 'linux')).toBe(false);
  });

  it('does not count CLAUDE_CODE_OAUTH_TOKEN as subscription evidence', () => {
    expect(detectSubscriptionCredentials({ CLAUDE_CODE_OAUTH_TOKEN: 'tok' }, 'linux')).toBe(false);
  });

  it('returns true when the credentials file contains claudeAiOauth', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ claudeAiOauth: { accessToken: 'x' } }));

    expect(detectSubscriptionCredentials({}, 'linux')).toBe(true);
    expect(mockExistsSync).toHaveBeenCalledWith('/home/user/.claude/.credentials.json');
  });

  it('respects CLAUDE_CONFIG_DIR for the credentials file location', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ claudeAiOauth: {} }));

    expect(detectSubscriptionCredentials({ CLAUDE_CONFIG_DIR: '/etc/claude' }, 'linux')).toBe(true);
    expect(mockExistsSync).toHaveBeenCalledWith('/etc/claude/.credentials.json');
  });

  it('returns false when the credentials file lacks claudeAiOauth', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ somethingElse: {} }));

    expect(detectSubscriptionCredentials({}, 'linux')).toBe(false);
  });

  it('treats an unreadable or unparseable credentials file as absent', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not json');

    expect(detectSubscriptionCredentials({}, 'linux')).toBe(false);
  });

  it('returns true on darwin when the Keychain holds Claude Code credentials', () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    expect(detectSubscriptionCredentials({}, 'darwin')).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials'],
      { stdio: 'ignore' },
    );
  });

  it('returns false on darwin when the Keychain lookup fails', () => {
    expect(detectSubscriptionCredentials({}, 'darwin')).toBe(false);
  });

  it('does not consult the Keychain on non-darwin platforms', () => {
    expect(detectSubscriptionCredentials({}, 'linux')).toBe(false);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

describe('buildSdkEnv', () => {
  it('always unsets CLAUDECODE and does not mutate the input env', () => {
    const env = { CLAUDECODE: '1', OTHER: 'kept' };
    const result = buildSdkEnv('auto', env);

    expect(result.CLAUDECODE).toBeUndefined();
    expect(result.OTHER).toBe('kept');
    expect(env.CLAUDECODE).toBe('1');
  });

  it('auto: strips API credentials when subscription credentials are detected', () => {
    const result = buildSdkEnv('auto', {
      ANTHROPIC_API_KEY: 'sk-ant-key',
      ANTHROPIC_AUTH_TOKEN: 'bearer',
      CLAUDE_SDK_OAUTH_TOKEN: 'tok',
    });

    expect(result.ANTHROPIC_API_KEY).toBeUndefined();
    expect(result.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(result.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok');
  });

  it('maps CLAUDE_SDK_OAUTH_TOKEN onto CLAUDE_CODE_OAUTH_TOKEN for the subprocess', () => {
    const result = buildSdkEnv('auto', { CLAUDE_SDK_OAUTH_TOKEN: 'tok' }, 'linux');

    expect(result.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok');
    expect(result.CLAUDE_SDK_OAUTH_TOKEN).toBeUndefined();
  });

  it('always strips an inherited CLAUDE_CODE_OAUTH_TOKEN', () => {
    const result = buildSdkEnv(
      'auto',
      { ANTHROPIC_API_KEY: 'sk-ant-key', CLAUDE_CODE_OAUTH_TOKEN: 'inherited' },
      'linux',
    );

    expect(result.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-key');
  });

  it('CLAUDE_SDK_OAUTH_TOKEN wins over an inherited CLAUDE_CODE_OAUTH_TOKEN', () => {
    const result = buildSdkEnv(
      'auto',
      { CLAUDE_CODE_OAUTH_TOKEN: 'inherited', CLAUDE_SDK_OAUTH_TOKEN: 'sdk-tok' },
      'linux',
    );

    expect(result.CLAUDE_CODE_OAUTH_TOKEN).toBe('sdk-tok');
  });

  it('throws a UsageError when CLAUDE_CODE_OAUTH_TOKEN is the only credential', () => {
    expect(() => buildSdkEnv('auto', { CLAUDE_CODE_OAUTH_TOKEN: 'tok' }, 'linux')).toThrow(
      UsageError,
    );
    expect(() => buildSdkEnv('subscription', { CLAUDE_CODE_OAUTH_TOKEN: 'tok' }, 'linux')).toThrow(
      /CLAUDE_SDK_OAUTH_TOKEN/,
    );
  });

  it('tolerates a set CLAUDE_CODE_OAUTH_TOKEN when another credential exists', () => {
    expect(() =>
      buildSdkEnv('auto', { CLAUDE_CODE_OAUTH_TOKEN: 'tok', ANTHROPIC_API_KEY: 'sk' }, 'linux'),
    ).not.toThrow();
    expect(() =>
      buildSdkEnv('auto', { CLAUDE_CODE_OAUTH_TOKEN: 'tok', CLAUDE_SDK_OAUTH_TOKEN: 'sdk' }, 'linux'),
    ).not.toThrow();

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ claudeAiOauth: {} }));
    expect(() => buildSdkEnv('auto', { CLAUDE_CODE_OAUTH_TOKEN: 'tok' }, 'linux')).not.toThrow();
  });

  it('auto: keeps API credentials when no subscription credentials are found', () => {
    const result = buildSdkEnv('auto', { ANTHROPIC_API_KEY: 'sk-ant-key' }, 'linux');

    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-key');
  });

  it('auto: skips detection entirely when no API credentials are present', () => {
    const result = buildSdkEnv('auto', {}, 'darwin');

    expect(result.ANTHROPIC_API_KEY).toBeUndefined();
    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('subscription: strips API credentials unconditionally', () => {
    const result = buildSdkEnv('subscription', {
      ANTHROPIC_API_KEY: 'sk-ant-key',
      ANTHROPIC_AUTH_TOKEN: 'bearer',
    });

    expect(result.ANTHROPIC_API_KEY).toBeUndefined();
    expect(result.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('api-key: strips both OAuth token variables and keeps the API key', () => {
    const result = buildSdkEnv('api-key', {
      ANTHROPIC_API_KEY: 'sk-ant-key',
      CLAUDE_CODE_OAUTH_TOKEN: 'tok',
      CLAUDE_SDK_OAUTH_TOKEN: 'sdk-tok',
    });

    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-key');
    expect(result.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(result.CLAUDE_SDK_OAUTH_TOKEN).toBeUndefined();
  });

  it('api-key: throws a UsageError when ANTHROPIC_API_KEY is unset or blank', () => {
    expect(() => buildSdkEnv('api-key', {})).toThrow(UsageError);
    expect(() => buildSdkEnv('api-key', { ANTHROPIC_API_KEY: '  ' })).toThrow(/ANTHROPIC_API_KEY/);
  });
});
