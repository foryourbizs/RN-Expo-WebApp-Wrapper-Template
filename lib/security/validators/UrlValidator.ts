// lib/security/validators/UrlValidator.ts
/**
 * URL 파서 기반 검증 (정규식 우회 방지)
 */

import { SecurityDecision, SecurityEventType, EventSeverity, SecurityEvent } from '../core/SecurityEvent';
import { SecurityPolicy } from '../core/SecurityPolicy';

// 사설 IP 범위 (SSRF 방지)
const PRIVATE_IP_RANGES = [
  /^127\./,                              // Loopback
  /^10\./,                               // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,     // Class B private
  /^192\.168\./,                         // Class C private
  /^169\.254\./,                         // Link-local
  /^0\./,                                // Current network
  /^::1$/,                               // IPv6 loopback
  /^\[::1\]$/,                           // Bracketed IPv6 loopback
  /^fe80:/i,                             // IPv6 link-local
  /^\[fe80:/i,                           // Bracketed IPv6 link-local
  /^fc00:/i,                             // IPv6 unique local
  /^\[fc00:/i,                           // Bracketed IPv6 unique local
  /^fd00:/i,                             // IPv6 unique local
  /^\[fd00:/i,                           // Bracketed IPv6 unique local
  /^::ffff:127\./i,                      // IPv4-mapped IPv6 loopback
  /^\[::ffff:127\./i,                    // Bracketed IPv4-mapped IPv6 loopback
  /^::ffff:10\./i,                       // IPv4-mapped IPv6 Class A
  /^\[::ffff:10\./i,                     // Bracketed IPv4-mapped IPv6 Class A
  /^::ffff:192\.168\./i,                 // IPv4-mapped IPv6 Class C
  /^\[::ffff:192\.168\./i,               // Bracketed IPv4-mapped IPv6 Class C
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i,  // IPv4-mapped IPv6 Class B
  /^\[::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i, // Bracketed IPv4-mapped IPv6 Class B
];

// localhost 패턴
const LOCALHOST_PATTERNS = [
  /^localhost$/i,
  /^localhost\./i,
  /\.localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
];

// 위험한 호모글리프 문자 범위 (유니코드 공격)
const HOMOGLYPH_RANGES: [number, number][] = [
  [0x0400, 0x04FF],  // Cyrillic
  [0x0370, 0x03FF],  // Greek
  [0x2000, 0x206F],  // General Punctuation (invisible chars)
  [0x2100, 0x214F],  // Letterlike Symbols
  [0xFF00, 0xFFEF],  // Fullwidth forms
];

export class UrlValidator {
  private policy: SecurityPolicy;

  constructor(policy: SecurityPolicy) {
    this.policy = policy;
  }

  /**
   * URL 종합 검증
   */
  validate(urlString: string): SecurityDecision {
    // 0. 입력 검증
    if (typeof urlString !== 'string' || urlString.length === 0) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Invalid URL: empty or not a string',
        { url: urlString }
      );
    }

    // 1. 기본 파싱
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Invalid URL format',
        { url: urlString }
      );
    }

    // 2. 스킴 검증
    const schemeResult = this.policy.validateUrlScheme(url.protocol);
    if (!schemeResult.allowed) return schemeResult;

    // 3. Null byte 검사
    const nullByteResult = this.checkNullBytes(urlString);
    if (!nullByteResult.allowed) return nullByteResult;

    // 4. 이중 인코딩 검사
    const doubleEncodingResult = this.checkDoubleEncoding(urlString);
    if (!doubleEncodingResult.allowed) return doubleEncodingResult;

    // 5. 호모글리프 검사 (호스트네임만)
    const homoglyphResult = this.checkHomoglyphs(urlString, url.hostname);
    if (!homoglyphResult.allowed) return homoglyphResult;

    // 6. SSRF 검사 (사설 IP/localhost)
    const ssrfResult = this.checkSSRF(url.hostname);
    if (!ssrfResult.allowed) return ssrfResult;

    // 7. Path traversal 검사
    const pathTraversalResult = this.checkPathTraversal(url.pathname);
    if (!pathTraversalResult.allowed) return pathTraversalResult;

    // 8. Origin 검증
    const originResult = this.policy.validateOrigin(url.origin);
    if (!originResult.allowed) return originResult;

    return { allowed: true };
  }

  /**
   * Null byte 검사 (이중 인코딩된 null byte 포함)
   */
  private checkNullBytes(url: string): SecurityDecision {
    if (url.includes('\x00') || url.includes('%00') || url.toLowerCase().includes('%2500')) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Null byte detected in URL',
        { url }
      );
    }
    return { allowed: true };
  }

  /**
   * 이중 인코딩 검사 (%25 패턴 - 인코딩된 % 기호만 탐지)
   */
  private checkDoubleEncoding(url: string): SecurityDecision {
    // %25는 인코딩된 '%' 문자로, 이중 인코딩의 명확한 지표
    // 예: %252F는 이중 인코딩된 '/' (%2F -> %252F)
    if (url.includes('%25')) {
      return this.createBlockedDecision(
        SecurityEventType.DOUBLE_ENCODING_DETECTED,
        'Double encoding detected (encoded percent sign)',
        { url }
      );
    }
    return { allowed: true };
  }

  /**
   * 호모글리프 검사 (유니코드 공격) - 호스트네임만 검사
   * 혼합 스크립트 호스트네임(ASCII + 비ASCII)만 차단하여 순수 IDN 도메인 허용
   */
  private checkHomoglyphs(url: string, hostname: string): SecurityDecision {
    let hasAscii = false;
    let hasNonAsciiHomoglyph = false;
    let suspiciousChar = '';
    let suspiciousCodePoint = 0;

    for (const char of hostname) {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) continue;

      // ASCII 문자 확인 (a-z, A-Z, 0-9, -, .)
      if ((codePoint >= 0x61 && codePoint <= 0x7a) ||
          (codePoint >= 0x41 && codePoint <= 0x5a) ||
          (codePoint >= 0x30 && codePoint <= 0x39) ||
          codePoint === 0x2d || codePoint === 0x2e) {
        hasAscii = true;
        continue;
      }

      // 호모글리프 범위의 비ASCII 문자 확인
      for (const [start, end] of HOMOGLYPH_RANGES) {
        if (codePoint >= start && codePoint <= end) {
          hasNonAsciiHomoglyph = true;
          suspiciousChar = char;
          suspiciousCodePoint = codePoint;
          break;
        }
      }
    }

    // 혼합 스크립트 호스트네임만 차단 (ASCII + 호모글리프 비ASCII 혼합)
    if (hasAscii && hasNonAsciiHomoglyph) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Mixed-script hostname detected (possible homoglyph attack)',
        { url, hostname, codePoint: suspiciousCodePoint, char: suspiciousChar }
      );
    }

    return { allowed: true };
  }

  /**
   * SSRF 검사 (사설 IP/localhost)
   */
  private checkSSRF(hostname: string): SecurityDecision {
    // localhost 패턴 확인
    for (const pattern of LOCALHOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return this.createBlockedDecision(
          SecurityEventType.SSRF_ATTEMPT_BLOCKED,
          'Localhost access blocked',
          { hostname },
          EventSeverity.ERROR
        );
      }
    }

    // 사설 IP 범위 확인
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) {
        return this.createBlockedDecision(
          SecurityEventType.SSRF_ATTEMPT_BLOCKED,
          'Private IP access blocked',
          { hostname },
          EventSeverity.ERROR
        );
      }
    }

    return { allowed: true };
  }

  /**
   * Path traversal 검사
   */
  private checkPathTraversal(pathname: string): SecurityDecision {
    // '..' 패턴 확인 (인코딩된 형태 포함)
    try {
      const decodedPath = decodeURIComponent(pathname);
      if (decodedPath.includes('..')) {
        return this.createBlockedDecision(
          SecurityEventType.URL_VALIDATION_FAILED,
          'Path traversal pattern detected',
          { pathname, decodedPath }
        );
      }
    } catch {
      // 디코딩 실패 시 원본 체크
      if (pathname.includes('..')) {
        return this.createBlockedDecision(
          SecurityEventType.URL_VALIDATION_FAILED,
          'Path traversal pattern detected',
          { pathname }
        );
      }
    }
    return { allowed: true };
  }

  /**
   * 스킴만 빠르게 검증
   */
  validateSchemeOnly(urlString: string): SecurityDecision {
    if (typeof urlString !== 'string' || urlString.length === 0) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Invalid URL: empty or not a string',
        { url: urlString }
      );
    }

    const colonIndex = urlString.indexOf(':');
    if (colonIndex === -1) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'No scheme in URL',
        { url: urlString }
      );
    }

    const scheme = urlString.substring(0, colonIndex).toLowerCase();

    // 스킴 형식 검증: RFC 3986에 따라 알파벳으로 시작하고 알파벳, 숫자, +, -, .만 허용
    if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Invalid scheme format',
        { url: urlString, scheme }
      );
    }

    return this.policy.validateUrlScheme(scheme);
  }

  /**
   * 차단 결정 생성 헬퍼
   */
  private createBlockedDecision(
    eventType: SecurityEventType,
    reason: string,
    details: Record<string, unknown>,
    severity: EventSeverity = EventSeverity.WARNING
  ): SecurityDecision {
    const event: SecurityEvent = {
      type: eventType,
      severity,
      timestamp: Date.now(),
      details,
      source: 'UrlValidator',
    };

    return {
      allowed: false,
      reason,
      event,
    };
  }
}
