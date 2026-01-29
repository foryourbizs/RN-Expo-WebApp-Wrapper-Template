// scripts/generate-plugin-registry.js
/**
 * plugins.json을 읽어 plugin-registry.ts를 자동 생성
 * 실행: node scripts/generate-plugin-registry.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_JSON = path.join(__dirname, '../constants/plugins.json');
const REGISTRY_TS = path.join(__dirname, '../lib/bridges/plugin-registry.ts');

async function generate() {
  // Read plugins.json
  const content = await fs.readFile(PLUGINS_JSON, 'utf-8');
  const config = JSON.parse(content);

  const autoPlugins = config.plugins?.auto || [];
  const manualPlugins = config.plugins?.manual || [];

  // Generate TypeScript content
  const output = `// lib/bridges/plugin-registry.ts
/**
 * 플러그인 레지스트리
 * - 동적 import를 위한 매핑 객체
 * - Metro 번들러 호환을 위해 정적 경로 사용
 *
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from: constants/plugins.json
 * Run: npm run generate:plugins
 */

/** Auto 플러그인 매핑 (npm 패키지) */
export const AUTO_PLUGINS: Record<string, () => Promise<any>> = {
${autoPlugins.map(p => `  '${p.name}': () => import('${p.name}'),`).join('\n')}
};

/** Manual 플러그인 매핑 (로컬 구현) */
export const MANUAL_PLUGINS: Record<string, () => Promise<any>> = {
${manualPlugins.map(p => `  '${p.path}': () => import('${p.path}'),`).join('\n')}
};
`;

  // Write output
  await fs.writeFile(REGISTRY_TS, output, 'utf-8');
  console.log('✅ Generated: lib/bridges/plugin-registry.ts');
}

generate().catch(console.error);
