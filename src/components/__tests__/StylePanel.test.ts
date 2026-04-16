import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(__dirname, '../StylePanel.tsx');
const source = readFileSync(SOURCE_PATH, 'utf-8');

describe('StylePanel module', () => {
  it('exports StylePanel as default function component', async () => {
    const mod = await import('../StylePanel');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
    expect(mod.default.name).toBe('StylePanel');
  });

  it('is re-exported from components index', async () => {
    const mod = await import('../index');
    expect(mod.StylePanel).toBeDefined();
    expect(typeof mod.StylePanel).toBe('function');
  });
});

describe('StylePanel source code – required controls (Req 4.1)', () => {
  it('contains a Chinese font select control', () => {
    expect(source).toContain('zh-font');
    expect(source).toMatch(/SimSun|宋体/);
  });

  it('contains an English font select control', () => {
    expect(source).toContain('en-font');
    expect(source).toContain('Times New Roman');
  });

  it('contains a font size input control', () => {
    expect(source).toContain('font-size');
    expect(source).toMatch(/fontSize/);
  });

  it('contains a border width input control', () => {
    expect(source).toContain('border-width');
    expect(source).toMatch(/borderWidth/);
  });

  it('contains a fill color input control', () => {
    expect(source).toContain('fill-color');
    expect(source).toMatch(/fillColor/);
  });

  it('contains a border color input control', () => {
    expect(source).toContain('border-color');
    expect(source).toMatch(/borderColor/);
  });

  it('uses onStyleChange callback for style updates', () => {
    expect(source).toContain('onStyleChange');
  });
});

describe('StylePanel – no login required (Req 7.1)', () => {
  it('does not reference any authentication or login logic', () => {
    expect(source).not.toMatch(/login|signIn|auth|session.*token/i);
  });
});
