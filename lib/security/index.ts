// lib/security/index.ts
/**
 * 보안 모듈 통합 export
 */

// Types
export * from './core/SecurityEvent';
export * from './config/SecurityConfig';

// Core
export { SecurityContext } from './core/SecurityContext';
export { SecurityPolicy } from './core/SecurityPolicy';

// Validators
export { UrlValidator } from './validators/UrlValidator';

// Guards
export { NavigationGuard } from './guards/NavigationGuard';
export type { NavigationRequest } from './guards/NavigationGuard';
export { InjectionGuard } from './guards/InjectionGuard';
export type { CodeSource } from './guards/InjectionGuard';

// Audit
export { SecurityLogger } from './audit/SecurityLogger';
export type { ExternalLogger } from './audit/SecurityLogger';

// Engine
export { SecurityEngine } from './SecurityEngine';
export type { BridgeMessage, WebViewSecurityHandlers } from './SecurityEngine';
