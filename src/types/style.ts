/**
 * StyleConfig — 样式配置接口
 * 定义流程图的视觉规范
 */

export interface StyleConfig {
  fontFamily: { zh: string; en: string };
  fontSize: number;
  borderWidth: number;
  borderColor: string;
  fillColor: string;
  arrowStyle: 'solid';
  lineStyle: 'orthogonal';
  colorScheme: 'monochrome';
}

/** academic-default 学术默认样式模板 */
export const ACADEMIC_DEFAULT_STYLE: StyleConfig = {
  fontFamily: { zh: 'SimSun', en: 'Times New Roman' },
  fontSize: 12,
  borderWidth: 1,
  borderColor: '#000000',
  fillColor: '#FFFFFF',
  arrowStyle: 'solid',
  lineStyle: 'orthogonal',
  colorScheme: 'monochrome',
};
