import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { readFile } from 'node:fs/promises';

const CheckValueSchema = z.object({
  check: z.string(),
  note: z.string().optional(),
  model: z.string().optional(),
});

const ChecksFileRawSchema = z.object({
  context: z.string().optional(),
  checks: z
    .array(z.record(z.string(), CheckValueSchema))
    .min(1, 'Checks file must have at least one check'),
});

export type Check = z.infer<typeof CheckValueSchema> & { id: string };
export type ChecksFile = {
  context?: string;
  checks: Check[];
};

/**
 * Parse and validate a checks YAML file.
 */
export async function loadChecksFile(filePath: string): Promise<ChecksFile> {
  const content = await readFile(filePath, 'utf8');
  return parseChecksFile(content);
}

/**
 * Parse and validate checks from a YAML string.
 * Each check entry is a single-key map: { id: { check, note?, model? } }
 */
export function parseChecksFile(yamlContent: string): ChecksFile {
  const raw = parseYaml(yamlContent);
  const parsed = ChecksFileRawSchema.parse(raw);

  const checks: Check[] = parsed.checks.map((entry) => {
    const keys = Object.keys(entry);
    if (keys.length !== 1) {
      throw new Error(
        `Each check entry must have exactly one key (the ID), got ${keys.length}: ${keys.join(', ')}`,
      );
    }
    const id = keys[0];
    const value = entry[id];
    return { id, ...value };
  });

  return {
    context: parsed.context,
    checks,
  };
}
