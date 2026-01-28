// lib/security/core/SecurityContext.ts
/**
 * 보안 상태 관리 싱글톤
 * 세션, 토큰, nonce, 위협 레벨 중앙 관리
 */

import { ThreatLevel } from './SecurityEvent';

const MAX_NONCE_CACHE = 1000;
const TOKEN_SYMBOL = Symbol('securityToken');

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const generateSecurityToken = (): string => {
  const uuids = Array.from({ length: 5 }, () => generateUUID());
  const highResTime = Date.now() * 1000000 + Math.floor(Math.random() * 1000000);
  const entropy = Array.from({ length: 3 }, () =>
    Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
  );
  const combined = `RNW-SEC-${uuids.join('-')}-${highResTime}-${entropy.join('-')}-${Date.now()}`;

  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16);
  const random = Math.random().toString(36).substring(2);
  const random2 = Math.random().toString(36).substring(2);
  const hashStr = `${hex}${random}${random2}`.substring(0, 64);

  return `${uuids[0]}-${hashStr}-${uuids[1].substring(0, 8)}`;
};

interface SessionInfo {
  sessionId: string;
  startedAt: number;
}

export class SecurityContext {
  private static instance: SecurityContext | null = null;
  private session: SessionInfo;
  private usedNonces: Set<string> = new Set();
  private verifiedOrigins: Set<string> = new Set();
  private threatLevel: ThreatLevel = ThreatLevel.NORMAL;
  private lockdownUntil: number = 0;
  private [TOKEN_SYMBOL]: string;

  private constructor() {
    this.session = { sessionId: generateUUID(), startedAt: Date.now() };
    this[TOKEN_SYMBOL] = generateSecurityToken();
  }

  static getInstance(): SecurityContext {
    if (!SecurityContext.instance) {
      SecurityContext.instance = new SecurityContext();
    }
    return SecurityContext.instance;
  }

  static resetInstance(): void {
    SecurityContext.instance = null;
  }

  getToken(): string {
    return this[TOKEN_SYMBOL];
  }

  validateToken(token: string): boolean {
    return token === this[TOKEN_SYMBOL];
  }

  getSession(): Readonly<SessionInfo> {
    return { ...this.session };
  }

  validateAndUseNonce(nonce: string): boolean {
    if (!nonce) return false;
    if (this.usedNonces.has(nonce)) return false;
    this.usedNonces.add(nonce);
    this.cleanupNonceCache();
    return true;
  }

  private cleanupNonceCache(): void {
    if (this.usedNonces.size > MAX_NONCE_CACHE) {
      const iterator = this.usedNonces.values();
      const toDelete = this.usedNonces.size - MAX_NONCE_CACHE;
      for (let i = 0; i < toDelete; i++) {
        const value = iterator.next().value;
        if (value) this.usedNonces.delete(value);
      }
    }
  }

  cacheVerifiedOrigin(origin: string): void {
    this.verifiedOrigins.add(origin);
  }

  isOriginCached(origin: string): boolean {
    return this.verifiedOrigins.has(origin);
  }

  getThreatLevel(): ThreatLevel {
    return this.threatLevel;
  }

  setThreatLevel(level: ThreatLevel): void {
    this.threatLevel = level;
  }

  activateLockdown(durationMs: number): void {
    this.lockdownUntil = Date.now() + durationMs;
    this.threatLevel = ThreatLevel.CRITICAL;
  }

  deactivateLockdown(): void {
    this.lockdownUntil = 0;
    this.threatLevel = ThreatLevel.NORMAL;
  }

  isLockdownActive(): boolean {
    if (this.lockdownUntil === 0) return false;
    if (Date.now() >= this.lockdownUntil) {
      this.deactivateLockdown();
      return false;
    }
    return true;
  }

  getLockdownRemainingMs(): number {
    if (!this.isLockdownActive()) return 0;
    return Math.max(0, this.lockdownUntil - Date.now());
  }
}
