/**
 * IR Schema 校验器
 * 使用 ajv 验证 IR 对象是否符合 JSON Schema
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import irSchema from './ir-schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(irSchema);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateIR(ir: unknown): ValidationResult {
  const valid = validate(ir);
  if (valid) {
    return { valid: true };
  }
  const errors = (validate.errors ?? []).map((e) => {
    const path = e.instancePath || '/';
    return `${path}: ${e.message}`;
  });
  return { valid: false, errors };
}
