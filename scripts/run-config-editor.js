#!/usr/bin/env node
/**
 * Config Editor 실행 스크립트
 *
 * API 플러그인과 WebSocket이 dev 모드에서만 동작하므로 dev 서버를 실행합니다.
 * 안정성을 위해 이전 프로세스 정리 및 node_modules 설치를 자동 처리합니다.
 *
 * 사용법:
 *   npm run config        # 일반 실행
 *   npm run config:dev    # dev 모드 (동일)
 *   npm run config:rebuild # 캐시 정리 후 실행
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const configEditorRoot = path.join(__dirname, '..', 'tools', 'config-editor');
const clientRoot = path.join(configEditorRoot, 'client');
const nodeModulesPath = path.join(clientRoot, 'node_modules');
const viteCachePath = path.join(clientRoot, 'node_modules', '.vite');

const isRebuild = process.argv.includes('--rebuild');

// 색상 출력
const log = {
  info: (msg) => console.log(`\x1b[36m[config-editor]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[config-editor]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[config-editor]\x1b[0m ${msg}`),
};

// npm 명령어 실행
function runNpmCommand(args, cwd) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npmCmd} ${args}`, { cwd, stdio: 'inherit' });
}

async function main() {
  try {
    // 1. --rebuild 옵션: Vite 캐시 삭제
    if (isRebuild && fs.existsSync(viteCachePath)) {
      log.info('Clearing Vite cache...');
      fs.rmSync(viteCachePath, { recursive: true, force: true });
    }

    // 2. node_modules 확인 및 설치
    if (!fs.existsSync(nodeModulesPath)) {
      log.info('Installing dependencies...');
      runNpmCommand('install --prefer-offline --no-audit --no-fund', clientRoot);
    }

    // 3. Dev 서버 실행
    log.info('Starting development server...');

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const devProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: clientRoot,
      stdio: 'inherit',
      shell: true
    });

    devProcess.on('close', (code) => {
      process.exit(code || 0);
    });

    // Ctrl+C 처리
    process.on('SIGINT', () => {
      devProcess.kill('SIGINT');
    });

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
