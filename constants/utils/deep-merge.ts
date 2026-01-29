/**
 * 객체 깊은 병합 유틸리티
 * JSON 설정 오버라이드용
 */

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 두 객체를 깊게 병합
 * @param target 기본값 객체
 * @param source 오버라이드 객체
 * @returns 병합된 객체
 */
export function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // 둘 다 객체면 재귀 병합
        (result as any)[key] = deepMerge(targetValue as object, sourceValue as object);
      } else if (sourceValue !== undefined) {
        // 그 외에는 오버라이드
        (result as any)[key] = sourceValue;
      }
    }
  }

  return result;
}

export type { DeepPartial };
