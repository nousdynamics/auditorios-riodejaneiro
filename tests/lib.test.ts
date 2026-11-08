import { describe, expect, it } from 'vitest';
import { splitSql } from '../src/worker/db/bootstrap';
import { hashPassword, verifyPassword } from '../src/worker/lib/crypto';
import { escapeHtml, html, jsonScript, paragraphs, raw } from '../src/worker/lib/html';

describe('html', () => {
  it('escapa valores interpolados', () => {
    const name = '<img src=x onerror=alert(1)>';
    expect(String(html`<p>${name}</p>`)).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });
  it('não escapa html aninhado nem raw()', () => {
    expect(String(html`<div>${html`<b>${'a&b'}</b>`}${raw('<i>ok</i>')}</div>`)).toBe('<div><b>a&amp;b</b><i>ok</i></div>');
  });
  it('ignora null/false e junta arrays', () => {
    expect(String(html`${null}${false}${['a', 'b']}`)).toBe('ab');
  });
  it('escapeHtml cobre aspas', () => {
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
  });
  it('jsonScript impede fechar a tag <script>', () => {
    expect(String(jsonScript({ a: '</script><script>alert(1)</script>' }))).not.toContain('</script>');
  });
  it('paragraphs separa por linha em branco e escapa', () => {
    expect(String(paragraphs('Um\n\nDois <b>'))).toBe('<p>Um</p><p>Dois &lt;b&gt;</p>');
  });
});

describe('senhas (PBKDF2)', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashPassword('senha-de-teste-123');
    expect(hash.startsWith('pbkdf2$100000$')).toBe(true);
    expect(await verifyPassword('senha-de-teste-123', hash)).toBe(true);
    expect(await verifyPassword('outra-senha', hash)).toBe(false);
  });
  it('recusa formato desconhecido', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });
});

describe('splitSql', () => {
  it('divide comandos e ignora comentários', () => {
    const sql = '-- comentário\nCREATE TABLE a (x INT);\n\nCREATE INDEX i ON a (x);\n';
    expect(splitSql(sql)).toEqual(['CREATE TABLE a (x INT)', 'CREATE INDEX i ON a (x)']);
  });
});
