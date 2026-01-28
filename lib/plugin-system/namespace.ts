// lib/plugin-system/namespace.ts

/**
 * 네임스페이스 구분자
 */
const NAMESPACE_SEPARATOR = ':';

/**
 * 네임스페이스 액션 파싱 결과
 */
export interface ParsedAction {
  key: string;
  action: string;
}

/**
 * 네임스페이스 액션 생성
 * @param key 플러그인 키 (예: 'cam')
 * @param action 액션명 (예: 'start')
 * @returns 네임스페이스 액션 (예: 'cam:start')
 */
export const createNamespacedAction = (key: string, action: string): string => {
  return `${key}${NAMESPACE_SEPARATOR}${action}`;
};

/**
 * 네임스페이스 액션 파싱
 * @param namespacedAction 네임스페이스 액션 (예: 'cam:start')
 * @returns 파싱 결과 또는 null
 */
export const parseNamespacedAction = (namespacedAction: string): ParsedAction | null => {
  const separatorIndex = namespacedAction.indexOf(NAMESPACE_SEPARATOR);

  if (separatorIndex === -1) {
    return null;
  }

  return {
    key: namespacedAction.substring(0, separatorIndex),
    action: namespacedAction.substring(separatorIndex + 1),
  };
};

/**
 * 네임스페이스 액션 여부 확인
 */
export const isNamespacedAction = (action: string): boolean => {
  return action.includes(NAMESPACE_SEPARATOR);
};

/**
 * 액션에서 플러그인 키 추출
 */
export const getPluginKeyFromAction = (action: string): string | null => {
  const parsed = parseNamespacedAction(action);
  return parsed?.key ?? null;
};
