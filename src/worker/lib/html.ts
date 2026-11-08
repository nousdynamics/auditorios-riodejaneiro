/**
 * Template HTML com escape automático. Todo valor interpolado é escapado,
 * exceto o que já for `SafeHtml` (resultado de outro `html\`\`` ou de `raw()`).
 * Arrays são concatenados; null/undefined/false viram string vazia.
 */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

type Value = SafeHtml | string | number | boolean | null | undefined | Value[];

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function render(value: Value): string {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: Value[]): SafeHtml {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Marca uma string como HTML confiável. Use só com conteúdo gerado pelo próprio código. */
export function raw(value: string): SafeHtml {
  return new SafeHtml(value);
}

/** JSON seguro para <script type="application/ld+json"> e <script type="application/json">. */
export function jsonScript(data: unknown): SafeHtml {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
  return new SafeHtml(json);
}

/** Texto com parágrafos (linha em branco) e quebras simples → <p> escapados. */
export function paragraphs(text: string): SafeHtml {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return new SafeHtml(blocks.map((b) => `<p>${escapeHtml(b).replace(/\n/g, '<br>')}</p>`).join(''));
}

export function attrs(map: Record<string, string | number | boolean | null | undefined>): SafeHtml {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (v === false || v === null || v === undefined) continue;
    parts.push(v === true ? k : `${k}="${escapeHtml(String(v))}"`);
  }
  return new SafeHtml(parts.join(' '));
}
