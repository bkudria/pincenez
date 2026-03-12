import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { readFile } from "node:fs/promises";

const AssertionSchema = z.object({
  id: z.string().optional(),
  check: z.string(),
  note: z.string().optional(),
  model: z.string().optional(),
});

const RubricSchema = z.object({
  context: z.string().optional(),
  assertions: z.array(AssertionSchema).min(1, "Rubric must have at least one assertion"),
});

export type Assertion = z.infer<typeof AssertionSchema> & { id: string };
export type Rubric = {
  context?: string;
  assertions: Assertion[];
};

/**
 * Parse and validate a rubric YAML file.
 * Auto-generates assertion IDs if missing.
 */
export async function loadRubric(filePath: string): Promise<Rubric> {
  const content = await readFile(filePath, "utf8");
  return parseRubric(content);
}

/**
 * Parse and validate rubric from a YAML string.
 */
export function parseRubric(yamlContent: string): Rubric {
  const raw = parseYaml(yamlContent);
  const parsed = RubricSchema.parse(raw);

  // Auto-generate IDs for assertions that don't have them
  const assertions: Assertion[] = parsed.assertions.map((a, i) => ({
    ...a,
    id: a.id ?? `assertion-${i}`,
  }));

  return {
    context: parsed.context,
    assertions,
  };
}
