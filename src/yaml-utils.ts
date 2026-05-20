import { Document, Scalar, visit } from 'yaml';
import wrap from 'word-wrap';

export const LINE_WIDTH = 80;
const ENTRY_PREFIX_WIDTH = 4;
export const DOC_LINE_WIDTH = LINE_WIDTH - ENTRY_PREFIX_WIDTH;
const HARD_WRAP_WIDTH = 72;
const FOLD_THRESHOLD = 64;

function hardWrapLines(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line.length <= HARD_WRAP_WIDTH
        ? line
        : wrap(line, { width: HARD_WRAP_WIDTH, indent: '', trim: true, cut: false }),
    )
    .join('\n');
}

export function applyWrapStyles(doc: Document): void {
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value !== 'string') return;
      if (node.value.includes('\n')) {
        node.value = hardWrapLines(node.value);
        node.type = Scalar.BLOCK_LITERAL;
      } else if (node.value.length > FOLD_THRESHOLD) {
        node.type = Scalar.BLOCK_FOLDED;
      }
    },
  });
}

/**
 * Serialize a JS object as a YAML mapping, indent it as a sequence item, and
 * write it to stdout. Long single-line strings render as block-folded scalars;
 * multi-line strings render as block-literal with each line hard-wrapped at
 * word boundaries first.
 */
export function writeYamlArrayItem(item: Record<string, unknown>): void {
  const doc = new Document(item);
  applyWrapStyles(doc);

  const serialized = doc.toString({ lineWidth: DOC_LINE_WIDTH }).trimEnd();
  const lines = serialized.split('\n');

  const yamlItem = lines
    .map((line: string, i: number) => (i === 0 ? `  - ${line}` : `    ${line}`))
    .join('\n');

  process.stdout.write(yamlItem + '\n');
}
