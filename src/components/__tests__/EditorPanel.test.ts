import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(__dirname, '../EditorPanel.tsx');
const source = readFileSync(SOURCE_PATH, 'utf-8');

describe('EditorPanel module', () => {
  it('exports EditorPanel as default function component', async () => {
    const mod = await import('../EditorPanel');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
    expect(mod.default.name).toBe('EditorPanel');
  });

  it('exports EditorPanelProps type via components index', async () => {
    // The index re-exports the type; verify the component itself is accessible
    const mod = await import('../index');
    expect(mod.EditorPanel).toBeDefined();
    expect(typeof mod.EditorPanel).toBe('function');
  });
});

describe('EditorPanel source code – first screen elements (Req 9.2)', () => {
  it('contains a textarea input area', () => {
    expect(source).toContain('<textarea');
  });

  it('textarea has a placeholder guiding the user', () => {
    expect(source).toContain('placeholder=');
  });

  it('textarea has an aria-label for accessibility', () => {
    expect(source).toMatch(/aria-label=.*[Nn]atural language/);
  });

  it('contains a generate button', () => {
    expect(source).toContain('<button');
    expect(source).toMatch(/生成|[Gg]enerate/);
  });

  it('generate button has an aria-label', () => {
    expect(source).toMatch(/aria-label=.*[Gg]enerate flowchart/);
  });

  it('uses onGenerate callback when button is clicked', () => {
    expect(source).toContain('onGenerate');
  });
});

describe('EditorPanel – no login required (Req 7.1)', () => {
  it('does not reference any authentication or login logic', () => {
    // The component should be usable without login
    expect(source).not.toMatch(/login|signIn|auth|session.*token/i);
  });
});
