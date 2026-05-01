import { Document, Scalar, visit } from 'yaml';

/**
 * Serialize a JS object as a YAML mapping, indent it as a sequence item, and
 * write it to stdout. Multiline strings are rendered as block literals.
 */
export function writeYamlArrayItem(item: Record<string, unknown>): void {
  const doc = new Document(item);
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value === 'string' && node.value.includes('\n')) {
        node.type = Scalar.BLOCK_LITERAL;
      }
    },
  });

  const serialized = doc.toString({ lineWidth: 0 }).trimEnd();
  const lines = serialized.split('\n');

  const yamlItem = lines
    .map((line: string, i: number) => (i === 0 ? `  - ${line}` : `    ${line}`))
    .join('\n');

  process.stdout.write(yamlItem + '\n');
}
