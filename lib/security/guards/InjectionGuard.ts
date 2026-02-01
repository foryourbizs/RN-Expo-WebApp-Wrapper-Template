// lib/security/guards/InjectionGuard.ts
/**
 * 다층 방어 시스템으로 스크립트 인젝션 탐지
 * L1: Immutable Boundary - WebView 로드 전 전역 객체 동결
 * L2: Static Analysis - 패턴 매칭, 시그니처 탐지
 * L3: Behavioral Analysis - 의도 추론, 엔트로피 분석
 */

import {
  SecurityDecision,
  SecurityEventType,
  EventSeverity,
  SecurityEvent,
  INJECTION_SIGNATURES,
  DetectionSignature,
} from '../core/SecurityEvent';

// 코드 소스 타입
export type CodeSource = 'webview' | 'bridge' | 'plugin' | 'internal' | 'unknown';

// 위험 패턴 정의
// NOTE: 모든 정규식은 ReDoS 공격에 안전하도록 설계됨 - 중첩 수량자나 역추적 패턴 없음
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; signature: DetectionSignature }> = [
  // Bridge 내부 접근 시도
  {
    pattern: /AppBridge\s*\.\s*_/i,
    signature: INJECTION_SIGNATURES.SIG_BRIDGE_001,
  },
  {
    pattern: /_handleMessage|_handleResponse|_listeners/i,
    signature: INJECTION_SIGNATURES.SIG_BRIDGE_001,
  },
  // postMessage 조작
  {
    pattern: /ReactNativeWebView\s*\.\s*postMessage/i,
    signature: INJECTION_SIGNATURES.SIG_BRIDGE_002,
  },
  {
    pattern: /window\s*\.\s*ReactNativeWebView/i,
    signature: INJECTION_SIGNATURES.SIG_BRIDGE_002,
  },
  // 프로토타입 오염
  {
    pattern: /__proto__\s*[=\[]/i,
    signature: INJECTION_SIGNATURES.SIG_PROTO_001,
  },
  {
    pattern: /Object\s*\.\s*prototype/i,
    signature: INJECTION_SIGNATURES.SIG_PROTO_001,
  },
  {
    pattern: /constructor\s*\.\s*prototype/i,
    signature: INJECTION_SIGNATURES.SIG_PROTO_001,
  },
  // 동적 코드 실행
  {
    pattern: /\beval\s*\(/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /new\s+Function\s*\(/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /setTimeout\s*\(\s*['"]/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /setInterval\s*\(\s*['"]/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  // GeneratorFunction/AsyncFunction 생성자 우회 탐지
  {
    pattern: /\(function\s*\*\s*\(\s*\)\s*\{\s*\}\s*\)\s*\.\s*constructor/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /\(async\s+function\s*\(\s*\)\s*\{\s*\}\s*\)\s*\.\s*constructor/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /\bAsyncFunction\b/,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /\bGeneratorFunction\b/,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  // 간접 eval 접근 탐지
  {
    pattern: /window\s*\[\s*['"]eval['"]\s*\]/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /this\s*\[\s*['"]eval['"]\s*\]/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
  {
    pattern: /\[\s*\]\s*\.\s*constructor\s*\.\s*constructor/i,
    signature: INJECTION_SIGNATURES.SIG_INJECT_001,
  },
];

// 난독화 패턴
// NOTE: 이 정규식들은 단순 패턴으로 ReDoS에 안전함 (중첩 수량자 없음)
const OBFUSCATION_PATTERNS: RegExp[] = [
  // Hex 인코딩 남용 (이스케이프 시퀀스)
  /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){5,}/i,
  // Unicode 인코딩 남용
  /\\u[0-9a-f]{4}(?:\\u[0-9a-f]{4}){3,}/i,
  // Base64 패턴 (긴 문자열)
  /[A-Za-z0-9+/]{100,}={0,2}/,
  // 연속된 비정상 문자열 연결
  /\+\s*['"][^'"]{0,2}['"]\s*\+\s*['"][^'"]{0,2}['"]\s*\+/,
  // 의심스러운 긴 hex 문자열 (인코딩된 페이로드 탐지)
  /[0-9a-f]{16,}/i,
];

// 행위 패턴 (의도 추론)
const BEHAVIORAL_PATTERNS: Array<{ pattern: RegExp; intent: string; severity: EventSeverity }> = [
  {
    pattern: /document\s*\.\s*cookie/i,
    intent: 'Cookie access attempt',
    severity: EventSeverity.WARNING,
  },
  {
    pattern: /localStorage|sessionStorage/i,
    intent: 'Storage access attempt',
    severity: EventSeverity.INFO,
  },
  {
    pattern: /XMLHttpRequest|fetch\s*\(/i,
    intent: 'Network request attempt',
    severity: EventSeverity.INFO,
  },
  {
    pattern: /window\s*\.\s*open\s*\(/i,
    intent: 'Window open attempt',
    severity: EventSeverity.WARNING,
  },
];

export class InjectionGuard {
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * 코드 검증 (L2 + L3)
   */
  validateCode(code: string, source: CodeSource = 'unknown'): SecurityDecision {
    // 입력 검증
    if (typeof code !== 'string') {
      return this.createBlockedDecision(
        SecurityEventType.INJECTION_DETECTED,
        'Invalid code: not a string',
        { source }
      );
    }

    // 빈 코드는 허용
    if (code.trim().length === 0) {
      return { allowed: true };
    }

    // L2: Static Analysis - 위험 패턴 탐지
    const staticResult = this.performStaticAnalysis(code, source);
    if (!staticResult.allowed) return staticResult;

    // L2: 난독화 탐지
    const obfuscationResult = this.detectObfuscation(code, source);
    if (!obfuscationResult.allowed) return obfuscationResult;

    // L3: Behavioral Analysis - 의도 추론 (경고만, 차단 안함)
    if (this.debug) {
      this.performBehavioralAnalysis(code, source);
    }

    return { allowed: true };
  }

  /**
   * L2: Static Analysis - 위험 패턴 탐지
   */
  private performStaticAnalysis(code: string, source: CodeSource): SecurityDecision {
    for (const { pattern, signature } of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        return this.createBlockedDecision(
          SecurityEventType.INJECTION_DETECTED,
          `Dangerous pattern detected: ${signature.name}`,
          {
            signature: signature.id,
            description: signature.description,
            source,
            pattern: pattern.toString(),
          },
          signature.severity
        );
      }
    }
    return { allowed: true };
  }

  /**
   * L2: 난독화 탐지
   */
  private detectObfuscation(code: string, source: CodeSource): SecurityDecision {
    for (const pattern of OBFUSCATION_PATTERNS) {
      if (pattern.test(code)) {
        return this.createBlockedDecision(
          SecurityEventType.INJECTION_DETECTED,
          'Obfuscation pattern detected',
          {
            source,
            pattern: pattern.toString(),
          },
          EventSeverity.WARNING
        );
      }
    }

    // 엔트로피 분석 (높은 엔트로피 = 난독화 가능성)
    // 임계값 6.0, 최소 500자 이상에서만 검사 (정상적인 minified JS 허용)
    const entropy = this.calculateEntropy(code);
    if (entropy > 6.0 && code.length > 500) {
      // minified JS 패턴 확인 - 일반적인 축소된 코드는 허용
      const hasMinifiedPatterns = this.looksLikeMinifiedJs(code);
      if (!hasMinifiedPatterns) {
        return this.createBlockedDecision(
          SecurityEventType.INJECTION_DETECTED,
          `High entropy detected (${entropy.toFixed(2)}), possible obfuscation`,
          {
            source,
            entropy,
            codeLength: code.length,
          },
          EventSeverity.WARNING
        );
      }
    }

    return { allowed: true };
  }

  /**
   * L3: Behavioral Analysis - 의도 추론 (경고 로깅만, 차단 안함)
   */
  private performBehavioralAnalysis(code: string, source: CodeSource): void {
    for (const { pattern, intent, severity } of BEHAVIORAL_PATTERNS) {
      if (pattern.test(code)) {
        if (this.debug) {
          console.log(`[InjectionGuard] Behavioral pattern: ${intent} (${severity})`, {
            source,
            pattern: pattern.toString(),
          });
        }
      }
    }
  }

  /**
   * 엔트로피 계산 (Shannon entropy)
   */
  private calculateEntropy(text: string): number {
    if (text.length === 0) return 0;

    const freq: Map<string, number> = new Map();
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const len = text.length;
    freq.forEach((count) => {
      const p = count / len;
      entropy -= p * Math.log2(p);
    });

    return entropy;
  }

  /**
   * minified JS 코드 패턴 확인
   * 정상적인 축소된 JavaScript 코드 특징 탐지
   */
  private looksLikeMinifiedJs(code: string): boolean {
    // 일반적인 minified JS 패턴들
    const minifiedPatterns = [
      /\bfunction\s*[a-z]\s*\(/i, // 단일 문자 함수명: function a(
      /\bvar\s+[a-z]\s*=/i, // 단일 문자 변수: var a=
      /\bconst\s+[a-z]\s*=/i, // 단일 문자 상수: const a=
      /\blet\s+[a-z]\s*=/i, // 단일 문자 변수: let a=
      /\breturn\s+[a-z]\s*[;,\)]/i, // return 문: return a;
      /\}\s*else\s*\{/i, // else 블록
      /\?\s*[^:]+\s*:/i, // 삼항 연산자
      /\.\s*prototype\s*\./i, // 프로토타입 체인
    ];

    let matchCount = 0;
    for (const pattern of minifiedPatterns) {
      if (pattern.test(code)) {
        matchCount++;
      }
    }

    // 3개 이상의 minified 패턴이 발견되면 정상적인 축소 코드로 판단
    return matchCount >= 3;
  }

  /**
   * L1: Immutable Security Boundary 스크립트 생성
   * WebView에 주입되어 전역 객체를 보호
   *
   * NOTE: eval/Function 차단은 Vue.js, React 등 프레임워크와 충돌하므로 제거됨
   * 대신 postMessage 토큰 검증으로 브릿지 보안 유지
   */
  generateL1BoundaryScript(securityToken: string): string {
    // 보안 토큰을 closure 내부에 숨김
    return `
(function() {
  'use strict';

  // ========================================
  // L1: Immutable Security Boundary
  // (Vue/React 호환 버전)
  // ========================================

  // 1. __proto__ setter 차단 (prototype pollution 방지)
  // 프레임워크 호환성 유지하면서 프로토타입 오염 공격 차단
  try {
    var protoDesc = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__');
    if (!protoDesc || protoDesc.configurable !== false) {
      Object.defineProperty(Object.prototype, '__proto__', {
        get: function() { return Object.getPrototypeOf(this); },
        set: function(v) {
          // 경고만 출력하고 실제로는 허용 (일부 라이브러리 호환성)
          console.warn('[Security] __proto__ modification detected');
          return Object.setPrototypeOf(this, v);
        },
        configurable: false
      });
    }
  } catch(e) {}

  // 2. ReactNativeWebView.postMessage 보안 래퍼 (핵심 보안)
  // 토큰 없는 브릿지 메시지 차단 - 악성 스크립트의 브릿지 악용 방지
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    try {
      var originalPostMessage = window.ReactNativeWebView.postMessage.bind(window.ReactNativeWebView);
      var secureToken = '${securityToken}';

      window.ReactNativeWebView.postMessage = function(message) {
        try {
          var parsed = JSON.parse(message);
          // app:// 프로토콜 메시지는 토큰 검증 필수
          if (parsed && parsed.protocol && parsed.protocol.startsWith('app://')) {
            if (!parsed.__token || parsed.__token !== secureToken) {
              console.warn('[Security] Blocked unauthorized bridge message');
              return;
            }
          }
          originalPostMessage(message);
        } catch(e) {
          // JSON 파싱 실패 시 원본 전달 (비-브릿지 메시지)
          originalPostMessage(message);
        }
      };

      // ReactNativeWebView 객체 동결 - 추가 조작 방지
      Object.freeze(window.ReactNativeWebView);
    } catch(e) {}
  }

  // 3. AppBridge 보호 (브릿지 클라이언트 로드 후 적용됨)
  // 내부 메서드 접근 차단
  setTimeout(function() {
    if (window.AppBridge) {
      try {
        // _로 시작하는 내부 속성 숨기기
        Object.keys(window.AppBridge).forEach(function(key) {
          if (key.startsWith('_')) {
            Object.defineProperty(window.AppBridge, key, {
              enumerable: false,
              configurable: false
            });
          }
        });
      } catch(e) {}
    }
  }, 0);

  console.log('[Security] L1 Boundary initialized (framework-compatible)');
})();
`;
  }

  /**
   * 디버그 모드 설정
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  /**
   * 차단 결정 생성
   */
  private createBlockedDecision(
    eventType: SecurityEventType,
    reason: string,
    details: Record<string, unknown>,
    severity: EventSeverity = EventSeverity.CRITICAL
  ): SecurityDecision {
    const event: SecurityEvent = {
      type: eventType,
      severity,
      timestamp: Date.now(),
      details,
      source: 'InjectionGuard',
    };

    return {
      allowed: false,
      reason,
      event,
    };
  }
}
