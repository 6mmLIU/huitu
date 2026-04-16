/**
 * SessionData — 会话数据接口
 * 用于 LocalStorage 持久化
 */

import type { IR } from './ir';
import type { StyleConfig } from './style';

export interface SessionData {
  ir: IR;
  styleConfig: StyleConfig;
  timestamp: number; // Unix 时间戳
  version: string; // 数据格式版本，用于迁移
}
