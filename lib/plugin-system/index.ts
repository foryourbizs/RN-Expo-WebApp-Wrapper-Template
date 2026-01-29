// lib/plugin-system/index.ts
export * from './types';
export * from './validation';
export * from './registry';
export * from './namespace';

/**
 * 문자열을 PascalCase로 변환
 * @example 'clip' → 'Clip', 'status-bar' → 'StatusBar'
 */
export const toPascalCase = (str: string): string => {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};
