'use client';

import type { StyleConfig } from '@/types/style';
import styles from './StylePanel.module.css';

export interface StylePanelProps {
  style: StyleConfig;
  onStyleChange: (config: StyleConfig) => void;
}

const ZH_FONT_OPTIONS = [
  { value: 'SimSun', label: '宋体 (SimSun)' },
  { value: 'Microsoft YaHei', label: '微软雅黑 (Microsoft YaHei)' },
  { value: 'KaiTi', label: '楷体 (KaiTi)' },
  { value: 'SimHei', label: '黑体 (SimHei)' },
];

const EN_FONT_OPTIONS = [
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Georgia', label: 'Georgia' },
];

export default function StylePanel({ style, onStyleChange }: StylePanelProps) {
  const update = (partial: Partial<StyleConfig>) => {
    onStyleChange({ ...style, ...partial });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>样式微调</span>
      </div>
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="zh-font">中文字体</label>
          <select
            id="zh-font"
            className={styles.select}
            value={style.fontFamily.zh}
            onChange={(e) =>
              update({ fontFamily: { ...style.fontFamily, zh: e.target.value } })
            }
          >
            {ZH_FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="en-font">英文字体</label>
          <select
            id="en-font"
            className={styles.select}
            value={style.fontFamily.en}
            onChange={(e) =>
              update({ fontFamily: { ...style.fontFamily, en: e.target.value } })
            }
          >
            {EN_FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="font-size">字号 (pt)</label>
          <input
            id="font-size"
            type="number"
            className={styles.numberInput}
            value={style.fontSize}
            min={8}
            max={24}
            step={1}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 8 && v <= 24) update({ fontSize: v });
            }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="border-width">边框粗细 (px)</label>
          <input
            id="border-width"
            type="number"
            className={styles.numberInput}
            value={style.borderWidth}
            min={0.5}
            max={4}
            step={0.5}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0.5 && v <= 4) update({ borderWidth: v });
            }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fill-color">填充色</label>
          <input
            id="fill-color"
            type="color"
            className={styles.colorInput}
            value={style.fillColor}
            onChange={(e) => update({ fillColor: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="border-color">边框色</label>
          <input
            id="border-color"
            type="color"
            className={styles.colorInput}
            value={style.borderColor}
            onChange={(e) => update({ borderColor: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
