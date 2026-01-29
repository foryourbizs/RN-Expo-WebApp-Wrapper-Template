// tools/config-editor/server/utils/npm.js
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../../..');

// npm 패키지 이름 유효성 검사
const NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function isValidPackageName(name) {
  return typeof name === 'string' &&
         name.length > 0 &&
         name.length <= 214 &&
         NPM_PACKAGE_REGEX.test(name);
}

// 검색 쿼리 유효성 검사 (기본 알파벳, 숫자, -, _, @, / 만 허용)
const SAFE_SEARCH_REGEX = /^[a-zA-Z0-9@/_-]+$/;

export function isValidSearchQuery(query) {
  return typeof query === 'string' &&
         query.length > 0 &&
         query.length <= 100 &&
         SAFE_SEARCH_REGEX.test(query);
}

// npm search (rnww-plugin-* 패키지)
export async function searchNpmPackages(query) {
  if (!isValidSearchQuery(query)) {
    console.error('Invalid search query:', query);
    return [];
  }
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['search', query, '--json'],
      { cwd: projectRoot, timeout: 30000 }
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error('npm search error:', error);
    return [];
  }
}

// 설치된 패키지 목록
export async function getInstalledPackages() {
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['list', '--json', '--depth=0'],
      { cwd: projectRoot }
    );
    const data = JSON.parse(stdout);
    return Object.entries(data.dependencies || {}).map(([name, info]) => ({
      name,
      version: info.version
    }));
  } catch (error) {
    // npm list는 peer dep 경고로 exit code 1 반환 가능
    if (error.stdout) {
      try {
        const data = JSON.parse(error.stdout);
        return Object.entries(data.dependencies || {}).map(([name, info]) => ({
          name,
          version: info.version
        }));
      } catch (parseError) {
        console.error('Failed to parse npm list output:', parseError);
        return [];
      }
    }
    console.error('npm list error:', error);
    return [];
  }
}

// 패키지 설치
export async function installPackage(packageName, version = 'latest') {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }

  const spec = version === 'latest' ? packageName : `${packageName}@${version}`;
  try {
    await execFileAsync('npm', ['install', spec], { cwd: projectRoot, timeout: 120000 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 패키지 제거
export async function uninstallPackage(packageName) {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }

  try {
    await execFileAsync('npm', ['uninstall', packageName], { cwd: projectRoot, timeout: 60000 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
