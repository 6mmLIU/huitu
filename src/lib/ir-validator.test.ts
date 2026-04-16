import type { IR } from '@/types/ir';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import { describe, expect, it } from 'vitest';
import { validateIR } from './ir-validator';

const validIR: IR = {
  version: '1.0',
  metadata: {
    title: '数据处理流程',
    createdAt: '2024-01-15T10:30:00Z',
    sourceLanguage: 'zh',
    chartType: 'conditional',
  },
  nodes: [
    { id: 'node_1', label: '开始', type: 'start' },
    { id: 'node_2', label: '读取数据', type: 'process' },
    { id: 'node_3', label: '数据有效？', type: 'decision' },
    { id: 'node_4', label: '结束', type: 'end' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
    {
      id: 'edge_3',
      source: 'node_3',
      target: 'node_4',
      label: '是',
      type: 'conditional',
    },
  ],
  groups: [],
};

describe('validateIR', () => {
  it('accepts a valid IR document', () => {
    const result = validateIR(validIR);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects IR missing required top-level fields', () => {
    const result = validateIR({ version: '1.0' });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('rejects IR with wrong version', () => {
    const result = validateIR({ ...validIR, version: '2.0' });
    expect(result.valid).toBe(false);
  });

  it('rejects node with invalid id prefix', () => {
    const badIR = {
      ...validIR,
      nodes: [{ id: 'bad_1', label: 'test', type: 'process' }],
    };
    const result = validateIR(badIR);
    expect(result.valid).toBe(false);
  });

  it('rejects node with empty label', () => {
    const badIR = {
      ...validIR,
      nodes: [{ id: 'node_1', label: '', type: 'process' }],
    };
    const result = validateIR(badIR);
    expect(result.valid).toBe(false);
  });

  it('rejects edge with invalid id prefix', () => {
    const badIR = {
      ...validIR,
      edges: [
        { id: 'bad_1', source: 'node_1', target: 'node_2', type: 'normal' },
      ],
    };
    const result = validateIR(badIR);
    expect(result.valid).toBe(false);
  });

  it('rejects group with invalid id prefix', () => {
    const badIR = {
      ...validIR,
      groups: [{ id: 'bad_1', label: 'Group', children: [] }],
    };
    const result = validateIR(badIR);
    expect(result.valid).toBe(false);
  });

  it('accepts IR with optional position and size on nodes', () => {
    const irWithLayout: IR = {
      ...validIR,
      nodes: [
        {
          id: 'node_1',
          label: 'Start',
          type: 'start',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 50 },
        },
      ],
    };
    const result = validateIR(irWithLayout);
    expect(result.valid).toBe(true);
  });

  it('accepts IR with groups containing parentGroupId', () => {
    const irWithGroups: IR = {
      ...validIR,
      groups: [
        { id: 'group_1', label: 'Parent', children: ['node_1'] },
        {
          id: 'group_2',
          label: 'Child',
          children: ['node_2'],
          parentGroupId: 'group_1',
        },
      ],
    };
    const result = validateIR(irWithGroups);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid metadata sourceLanguage', () => {
    const badIR = {
      ...validIR,
      metadata: { ...validIR.metadata, sourceLanguage: 'fr' },
    };
    const result = validateIR(badIR);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid metadata chartType', () => {
    const badIR = {
      ...validIR,
      metadata: { ...validIR.metadata, chartType: 'unknown' },
    };
    const result = validateIR(badIR);
    expect(result.valid).toBe(false);
  });
});

describe('ACADEMIC_DEFAULT_STYLE', () => {
  it('uses SimSun for Chinese font', () => {
    expect(ACADEMIC_DEFAULT_STYLE.fontFamily.zh).toBe('SimSun');
  });

  it('uses Times New Roman for English font', () => {
    expect(ACADEMIC_DEFAULT_STYLE.fontFamily.en).toBe('Times New Roman');
  });

  it('uses monochrome color scheme', () => {
    expect(ACADEMIC_DEFAULT_STYLE.colorScheme).toBe('monochrome');
  });

  it('uses solid arrow style', () => {
    expect(ACADEMIC_DEFAULT_STYLE.arrowStyle).toBe('solid');
  });

  it('uses orthogonal line style', () => {
    expect(ACADEMIC_DEFAULT_STYLE.lineStyle).toBe('orthogonal');
  });

  it('uses white fill and black border', () => {
    expect(ACADEMIC_DEFAULT_STYLE.fillColor).toBe('#FFFFFF');
    expect(ACADEMIC_DEFAULT_STYLE.borderColor).toBe('#000000');
  });

  it('defaults to fontSize 12 and borderWidth 1', () => {
    expect(ACADEMIC_DEFAULT_STYLE.fontSize).toBe(12);
    expect(ACADEMIC_DEFAULT_STYLE.borderWidth).toBe(1);
  });
});
