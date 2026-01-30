// tools/config-editor/vite/api-plugin.ts
// Vite plugin to handle API routes directly without separate Express server

import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// NDK/SDK 라이선스 에러 패턴
const LICENSE_ERROR_PATTERNS = [
  /License for package .* not accepted/i,
  /Failed to install the following Android SDK packages/i,
  /You have not accepted the license agreements/i,
];

// 라이선스 에러 감지
function detectLicenseError(text: string): boolean {
  return LICENSE_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

// SDK 라이선스 자동 수락
async function acceptSdkLicenses(sdkPath?: string): Promise<{ success: boolean; message: string }> {
  // SDK 경로 결정
  const androidHome = sdkPath || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : '');

  if (!androidHome) {
    return { success: false, message: 'Android SDK path not found' };
  }

  // sdkmanager 경로 찾기
  const sdkmanagerPaths = [
    path.join(androidHome, 'cmdline-tools', 'latest', 'bin', process.platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager'),
    path.join(androidHome, 'tools', 'bin', process.platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager'),
  ];

  let sdkmanagerPath: string | null = null;
  for (const p of sdkmanagerPaths) {
    if (fsSync.existsSync(p)) {
      sdkmanagerPath = p;
      break;
    }
  }

  if (!sdkmanagerPath) {
    return { success: false, message: 'sdkmanager not found in Android SDK' };
  }

  try {
    // 라이선스 수락 (yes를 여러 번 전송)
    const yesInput = 'y\ny\ny\ny\ny\ny\ny\ny\ny\ny\n';

    if (process.platform === 'win32') {
      // Windows: echo로 yes 입력
      await execAsync(`echo ${yesInput.replace(/\n/g, '& echo ')} | "${sdkmanagerPath}" --licenses`, {
        timeout: 120000,
        env: { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
      });
    } else {
      // Unix: yes 명령어 사용
      await execAsync(`yes | "${sdkmanagerPath}" --licenses`, {
        timeout: 120000,
        env: { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
      });
    }

    return { success: true, message: 'SDK licenses accepted successfully' };
  } catch (error: any) {
    // sdkmanager가 exit code 1을 반환해도 라이선스는 수락됐을 수 있음
    if (error.stdout?.includes('accepted') || error.stderr?.includes('accepted')) {
      return { success: true, message: 'SDK licenses accepted' };
    }
    return { success: false, message: `Failed to accept licenses: ${error.message}` };
  }
}

// Build process management
interface BuildProcess {
  process: ChildProcess;
  output: Array<{ type: string; text: string; timestamp: number }>;
  finished: boolean;
}

const buildProcesses: Map<string, BuildProcess> = new Map();

// Project root (where package.json is)
const projectRoot = path.resolve(__dirname, '../../../..');
const constantsDir = path.join(projectRoot, 'constants');
const bridgesDir = path.join(projectRoot, 'lib/bridges');

// Config files
const CONFIG_FILES: Record<string, string> = {
  app: 'app.json',
  theme: 'theme.json',
  plugins: 'plugins.json',
  'build-env': 'build-env.json'
};

// Validation
const NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const SAFE_SEARCH_REGEX = /^[a-zA-Z0-9@/_-]+$/;

function isValidPackageName(name: string): boolean {
  return typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 214 &&
    NPM_PACKAGE_REGEX.test(name);
}

function isValidSearchQuery(query: string): boolean {
  return typeof query === 'string' &&
    query.length > 0 &&
    query.length <= 100 &&
    SAFE_SEARCH_REGEX.test(query);
}

// npm utilities
async function searchNpmPackages(query: string) {
  if (!isValidSearchQuery(query)) {
    console.log('[api-plugin] Invalid search query:', query);
    return [];
  }
  try {
    console.log('[api-plugin] Searching npm for:', query);
    const { stdout } = await execAsync(`npm search "${query}" --json`, {
      cwd: projectRoot,
      timeout: 60000
    });
    const results = JSON.parse(stdout);
    console.log('[api-plugin] Search results count:', results.length);
    return results;
  } catch (error) {
    console.error('[api-plugin] npm search error:', error);
    return [];
  }
}

async function getInstalledPackages() {
  try {
    const { stdout } = await execAsync('npm list --json --depth=0', {
      cwd: projectRoot
    });
    const data = JSON.parse(stdout);
    return Object.entries(data.dependencies || {}).map(([name, info]: [string, any]) => ({
      name,
      version: info.version
    }));
  } catch (error: any) {
    // npm list는 peer dep 경고로 exit code 1 반환 가능
    if (error.stdout) {
      try {
        const data = JSON.parse(error.stdout);
        return Object.entries(data.dependencies || {}).map(([name, info]: [string, any]) => ({
          name,
          version: info.version
        }));
      } catch {
        return [];
      }
    }
    console.error('[api-plugin] npm list error:', error.message);
    return [];
  }
}

async function installPackage(packageName: string, version = 'latest') {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }
  const spec = version === 'latest' ? packageName : `${packageName}@${version}`;
  try {
    await execAsync(`npm install ${spec}`, { cwd: projectRoot, timeout: 120000 });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function uninstallPackage(packageName: string) {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }
  try {
    await execAsync(`npm uninstall ${packageName}`, { cwd: projectRoot, timeout: 60000 });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function regeneratePluginRegistry() {
  try {
    await execAsync('npm run generate:plugins', { cwd: projectRoot });
    console.log('[api-plugin] Plugin registry regenerated');
  } catch (e) {
    console.error('[api-plugin] Failed to regenerate plugin registry:', e);
  }
}

// 네임스페이스 충돌 검사
function validatePluginNamespaces(config: any): { valid: boolean; conflicts: Array<{ namespace: string; plugins: string[] }> } {
  const allPlugins = [
    ...(config.plugins?.auto || []).map((p: any) => ({ ...p, id: p.name, type: 'auto' })),
    ...(config.plugins?.manual || []).map((p: any) => ({ ...p, id: p.path, type: 'manual' }))
  ];

  const namespaceMap = new Map<string, string[]>();

  allPlugins.forEach((plugin: any) => {
    const ns = plugin.namespace;
    const id = plugin.id;
    if (ns) {
      if (!namespaceMap.has(ns)) {
        namespaceMap.set(ns, []);
      }
      namespaceMap.get(ns)!.push(id);
    }
  });

  const conflicts: Array<{ namespace: string; plugins: string[] }> = [];
  namespaceMap.forEach((plugins, namespace) => {
    if (plugins.length > 1) {
      conflicts.push({ namespace, plugins });
    }
  });

  return { valid: conflicts.length === 0, conflicts };
}

// Helper to read request body
async function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Helper to send JSON response
function sendJson(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// ========== Build Environment ==========

interface BuildEnvConfig {
  android?: {
    sdkPath?: string;
    javaHome?: string;
  };
  ios?: {
    xcodeSelectPath?: string;
  };
}

async function loadBuildEnv(): Promise<BuildEnvConfig> {
  try {
    const content = await fs.readFile(path.join(constantsDir, 'build-env.json'), 'utf-8');
    const data = JSON.parse(content);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, ...config } = data;
    return config;
  } catch {
    return {};
  }
}

async function saveBuildEnv(config: BuildEnvConfig): Promise<void> {
  const data = {
    $schema: './schemas/build-env.schema.json',
    ...config
  };
  await fs.writeFile(
    path.join(constantsDir, 'build-env.json'),
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  );
}

// local.properties 업데이트
async function updateLocalProperties(sdkPath: string): Promise<void> {
  const localPropsPath = path.join(projectRoot, 'android', 'local.properties');
  // 경로를 gradle 형식으로 변환 (백슬래시 이스케이프)
  const escapedPath = sdkPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  const content = `sdk.dir=${escapedPath}\n`;
  await fs.writeFile(localPropsPath, content, 'utf-8');
}

async function checkBuildEnvironment(): Promise<Array<{ name: string; status: string; message: string; detail?: string }>> {
  const checks: Array<{ name: string; status: string; message: string; detail?: string }> = [];
  const buildEnv = await loadBuildEnv();

  // 1. Node.js
  try {
    const { stdout } = await execAsync('node -v');
    checks.push({ name: 'Node.js', status: 'ok', message: stdout.trim() });
  } catch {
    checks.push({ name: 'Node.js', status: 'error', message: 'Not installed' });
  }

  // 2. npm
  try {
    const { stdout } = await execAsync('npm -v');
    checks.push({ name: 'npm', status: 'ok', message: `v${stdout.trim()}` });
  } catch {
    checks.push({ name: 'npm', status: 'error', message: 'Not installed' });
  }

  // 3. Java - build-env.json의 javaHome 우선 사용
  const javaHome = buildEnv.android?.javaHome || process.env.JAVA_HOME;
  if (javaHome) {
    try {
      const javaCmd = path.join(javaHome, 'bin', 'java');
      const { stderr } = await execAsync(`"${javaCmd}" -version`);
      const match = stderr.match(/version "([^"]+)"/);
      const version = match ? match[1] : 'Unknown';
      const major = parseInt(version.split('.')[0]);
      if (major >= 17 && major <= 21) {
        checks.push({ name: 'Java', status: 'ok', message: version });
      } else if (major > 21) {
        checks.push({ name: 'Java', status: 'warning', message: version, detail: 'JDK 17-21 recommended' });
      } else {
        checks.push({ name: 'Java', status: 'error', message: version, detail: 'JDK 17+ required' });
      }
    } catch {
      // fallback to system java
      try {
        const { stderr } = await execAsync('java -version');
        const match = stderr.match(/version "([^"]+)"/);
        const version = match ? match[1] : 'Unknown';
        checks.push({ name: 'Java', status: 'ok', message: version });
      } catch {
        checks.push({ name: 'Java', status: 'error', message: 'Not installed', detail: 'Install JDK 17+' });
      }
    }
  } else {
    try {
      const { stderr } = await execAsync('java -version');
      const match = stderr.match(/version "([^"]+)"/);
      const version = match ? match[1] : 'Unknown';
      checks.push({ name: 'Java', status: 'ok', message: version });
    } catch {
      checks.push({ name: 'Java', status: 'error', message: 'Not installed', detail: 'Install JDK 17+' });
    }
  }

  // 4. JAVA_HOME
  if (buildEnv.android?.javaHome) {
    checks.push({ name: 'JAVA_HOME', status: 'ok', message: buildEnv.android.javaHome, detail: '(config)' });
  } else if (process.env.JAVA_HOME) {
    checks.push({ name: 'JAVA_HOME', status: 'ok', message: process.env.JAVA_HOME });
  } else {
    checks.push({ name: 'JAVA_HOME', status: 'warning', message: 'Not set' });
  }

  // 5. Android SDK - build-env.json의 sdkPath 우선 사용
  const androidHome = buildEnv.android?.sdkPath || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome && fsSync.existsSync(path.join(androidHome, 'platform-tools'))) {
    const source = buildEnv.android?.sdkPath ? '(config)' : undefined;
    checks.push({ name: 'Android SDK', status: 'ok', message: androidHome, detail: source });
  } else if (androidHome) {
    checks.push({ name: 'Android SDK', status: 'warning', message: androidHome, detail: 'platform-tools missing' });
  } else {
    checks.push({ name: 'Android SDK', status: 'error', message: 'Not found', detail: 'Set ANDROID_HOME or configure in settings' });
  }

  // 6. EAS CLI
  try {
    const { stdout } = await execAsync('npx eas --version');
    checks.push({ name: 'EAS CLI', status: 'ok', message: stdout.trim() });
  } catch {
    checks.push({ name: 'EAS CLI', status: 'info', message: 'Not installed', detail: 'Required for cloud builds' });
  }

  // 7. android folder
  if (fsSync.existsSync(path.join(projectRoot, 'android'))) {
    checks.push({ name: 'Android Project', status: 'ok', message: 'Found' });
  } else {
    checks.push({ name: 'Android Project', status: 'info', message: 'Not found', detail: 'Run expo prebuild first' });
  }

  // 8. Keystore
  const keystorePaths = [
    path.join(projectRoot, 'android', 'app', 'release.keystore'),
    path.join(projectRoot, 'android', 'app', 'my-release-key.keystore'),
    path.join(projectRoot, 'android', 'keystores', 'release.keystore')
  ];
  const hasKeystore = keystorePaths.some(p => fsSync.existsSync(p));
  if (hasKeystore) {
    checks.push({ name: 'Release Keystore', status: 'ok', message: 'Found' });
  } else {
    checks.push({ name: 'Release Keystore', status: 'info', message: 'Not found', detail: 'Required for release builds' });
  }

  return checks;
}

function startBuildProcess(type: string, profile: string, buildId: string, retryCount = 0): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  let cmd: string;
  let args: string[];
  let licenseErrorDetected = false;
  let allOutputText = ''; // 전체 출력을 누적하여 라이선스 에러 감지

  if (type === 'cloud') {
    // EAS Cloud Build
    cmd = 'npx';
    args = ['eas', 'build', '--platform', 'android', '--profile', profile, '--non-interactive'];
    output.push({ type: 'info', text: `Starting EAS cloud build (${profile})...`, timestamp: Date.now() });
  } else {
    // Local Build - need to run prebuild first, then gradle
    const gradleTask = profile === 'debug' ? 'assembleDebug' :
                       profile === 'release-apk' ? 'assembleRelease' :
                       'bundleRelease';

    // Create a batch script to run the full build sequence
    cmd = process.platform === 'win32' ? 'cmd' : 'sh';
    const buildScript = process.platform === 'win32'
      ? `node scripts\\setup-plugins.js && npx expo prebuild --platform android && cd android && .\\gradlew ${gradleTask}`
      : `node scripts/setup-plugins.js && npx expo prebuild --platform android && cd android && ./gradlew ${gradleTask}`;
    args = process.platform === 'win32' ? ['/c', buildScript] : ['-c', buildScript];

    output.push({ type: 'info', text: `Starting local build (${profile})...`, timestamp: Date.now() });
    output.push({ type: 'info', text: `Gradle task: ${gradleTask}`, timestamp: Date.now() });
  }

  const proc = spawn(cmd, args, {
    cwd: projectRoot,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  const buildProcess: BuildProcess = { process: proc, output, finished: false };

  const checkAndHandleLicenseError = (text: string) => {
    allOutputText += text + '\n';
    if (!licenseErrorDetected && detectLicenseError(allOutputText)) {
      licenseErrorDetected = true;
    }
  };

  proc.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) {
      output.push({ type: 'stdout', text, timestamp: Date.now() });
      checkAndHandleLicenseError(text);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) {
      output.push({ type: 'stderr', text, timestamp: Date.now() });
      checkAndHandleLicenseError(text);
    }
  });

  proc.on('close', async (code) => {
    // 라이선스 에러가 감지되고 재시도 횟수가 남아있으면 자동 수정 후 재빌드
    if (code !== 0 && licenseErrorDetected && retryCount < 2) {
      output.push({ type: 'info', text: '⚠️ SDK/NDK license issue detected. Attempting automatic fix...', timestamp: Date.now() });

      // build-env.json에서 SDK 경로 가져오기
      const buildEnv = await loadBuildEnv();
      const sdkPath = buildEnv.android?.sdkPath;

      output.push({ type: 'info', text: 'Accepting SDK licenses...', timestamp: Date.now() });
      const licenseResult = await acceptSdkLicenses(sdkPath);

      if (licenseResult.success) {
        output.push({ type: 'success', text: `✓ ${licenseResult.message}`, timestamp: Date.now() });
        output.push({ type: 'info', text: '🔄 Restarting build...', timestamp: Date.now() });

        // 새 빌드 프로세스 시작 (재시도 횟수 증가)
        const newBuildProcess = startBuildProcess(type, profile, buildId, retryCount + 1);

        // 기존 buildProcess 객체를 새 프로세스로 업데이트
        buildProcess.process = newBuildProcess.process;

        // 새 프로세스의 출력을 기존 output 배열에 연결
        const originalOutput = newBuildProcess.output;
        const pollInterval = setInterval(() => {
          while (originalOutput.length > 0) {
            output.push(originalOutput.shift()!);
          }
          if (newBuildProcess.finished) {
            clearInterval(pollInterval);
            buildProcess.finished = true;
          }
        }, 100);
      } else {
        output.push({ type: 'error', text: `✗ ${licenseResult.message}`, timestamp: Date.now() });
        output.push({ type: 'info', text: 'Manual fix required: Run "sdkmanager --licenses" in your Android SDK directory', timestamp: Date.now() });
        buildProcess.finished = true;
        output.push({ type: 'error', text: `Build failed with exit code ${code}`, timestamp: Date.now() });
      }
      return;
    }

    buildProcess.finished = true;
    if (code === 0) {
      output.push({ type: 'success', text: 'Build completed successfully!', timestamp: Date.now() });

      // Show output path for local builds
      if (type === 'local') {
        const outputPath = profile === 'debug'
          ? 'android/app/build/outputs/apk/debug/app-debug.apk'
          : profile === 'release-apk'
          ? 'android/app/build/outputs/apk/release/app-release.apk'
          : 'android/app/build/outputs/bundle/release/app-release.aab';
        output.push({ type: 'info', text: `Output: ${outputPath}`, timestamp: Date.now() });
      }
    } else {
      output.push({ type: 'error', text: `Build failed with exit code ${code}`, timestamp: Date.now() });
    }
  });

  proc.on('error', (err) => {
    buildProcess.finished = true;
    output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
  });

  return buildProcess;
}

async function cleanDirectories(): Promise<string[]> {
  const dirsToClean = [
    path.join(projectRoot, 'android', 'app', '.cxx'),
    path.join(projectRoot, 'android', 'app', 'build'),
    path.join(projectRoot, 'android', '.gradle'),
    path.join(projectRoot, 'android', 'build'),
  ];

  const cleaned: string[] = [];

  for (const dir of dirsToClean) {
    if (fsSync.existsSync(dir)) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        cleaned.push(path.basename(dir));
      } catch (e) {
        // 삭제 실패해도 계속 진행
      }
    }
  }

  return cleaned;
}

function startCleanProcess(buildId: string): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  output.push({ type: 'info', text: 'Cleaning build cache...', timestamp: Date.now() });

  const buildProcess: BuildProcess = {
    process: null as any,
    output,
    finished: false
  };

  // 비동기로 디렉토리 삭제 후 gradlew clean 실행
  (async () => {
    try {
      // 1. 먼저 문제가 되는 디렉토리들 삭제
      output.push({ type: 'info', text: 'Removing .cxx and build directories...', timestamp: Date.now() });
      const cleaned = await cleanDirectories();
      if (cleaned.length > 0) {
        output.push({ type: 'stdout', text: `Deleted: ${cleaned.join(', ')}`, timestamp: Date.now() });
      }

      // 2. Gradle daemon 중지 및 clean 실행
      output.push({ type: 'info', text: 'Stopping Gradle daemon...', timestamp: Date.now() });

      const cmd = process.platform === 'win32' ? 'cmd' : 'sh';
      const cleanScript = process.platform === 'win32'
        ? 'cd android && .\\gradlew --stop'
        : 'cd android && ./gradlew --stop';
      const args = process.platform === 'win32' ? ['/c', cleanScript] : ['-c', cleanScript];

      const proc = spawn(cmd, args, {
        cwd: projectRoot,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      buildProcess.process = proc;

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stdout', text, timestamp: Date.now() });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stderr', text, timestamp: Date.now() });
        }
      });

      proc.on('close', (code) => {
        buildProcess.finished = true;
        if (code === 0) {
          output.push({ type: 'success', text: 'Cache cleaned successfully!', timestamp: Date.now() });
          output.push({ type: 'info', text: 'Run a build to regenerate native code.', timestamp: Date.now() });
        } else {
          // Gradle stop이 실패해도 디렉토리는 삭제됐으므로 성공으로 처리
          output.push({ type: 'success', text: 'Build directories cleaned. Gradle daemon may need manual stop.', timestamp: Date.now() });
        }
      });

      proc.on('error', (err) => {
        buildProcess.finished = true;
        output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
      });

    } catch (err: any) {
      buildProcess.finished = true;
      output.push({ type: 'error', text: `Clean error: ${err.message}`, timestamp: Date.now() });
    }
  })();

  return buildProcess;
}

function startDeepCleanProcess(buildId: string): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  output.push({ type: 'info', text: 'Starting deep clean...', timestamp: Date.now() });

  const buildProcess: BuildProcess = {
    process: null as any,
    output,
    finished: false
  };

  (async () => {
    try {
      // 1. Gradle daemon 중지
      output.push({ type: 'info', text: 'Stopping Gradle daemon...', timestamp: Date.now() });
      try {
        await execAsync(
          process.platform === 'win32'
            ? 'cd android && .\\gradlew --stop'
            : 'cd android && ./gradlew --stop',
          { cwd: projectRoot, timeout: 30000 }
        );
        output.push({ type: 'stdout', text: 'Gradle daemon stopped', timestamp: Date.now() });
      } catch {
        output.push({ type: 'stdout', text: 'Gradle daemon stop skipped (may not be running)', timestamp: Date.now() });
      }

      // 2. android 폴더 삭제
      const androidDir = path.join(projectRoot, 'android');
      if (fsSync.existsSync(androidDir)) {
        output.push({ type: 'info', text: 'Removing android folder...', timestamp: Date.now() });
        await fs.rm(androidDir, { recursive: true, force: true });
        output.push({ type: 'stdout', text: 'android folder deleted', timestamp: Date.now() });
      }

      // 3. expo prebuild 실행
      output.push({ type: 'info', text: 'Running expo prebuild...', timestamp: Date.now() });

      const cmd = process.platform === 'win32' ? 'cmd' : 'sh';
      const prebuildScript = 'npx expo prebuild --platform android';
      const args = process.platform === 'win32' ? ['/c', prebuildScript] : ['-c', prebuildScript];

      const proc = spawn(cmd, args, {
        cwd: projectRoot,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      buildProcess.process = proc;

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stdout', text, timestamp: Date.now() });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stderr', text, timestamp: Date.now() });
        }
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          // 4. local.properties 복원 (build-env.json에서)
          try {
            const buildEnv = await loadBuildEnv();
            if (buildEnv.android?.sdkPath) {
              await updateLocalProperties(buildEnv.android.sdkPath);
              output.push({ type: 'stdout', text: 'local.properties restored', timestamp: Date.now() });
            }
          } catch {
            output.push({ type: 'stderr', text: 'Warning: Could not restore local.properties', timestamp: Date.now() });
          }

          output.push({ type: 'success', text: 'Deep clean completed!', timestamp: Date.now() });
        } else {
          output.push({ type: 'error', text: `Prebuild failed with exit code ${code}`, timestamp: Date.now() });
        }
        buildProcess.finished = true;
      });

      proc.on('error', (err) => {
        buildProcess.finished = true;
        output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
      });

    } catch (err: any) {
      buildProcess.finished = true;
      output.push({ type: 'error', text: `Deep clean error: ${err.message}`, timestamp: Date.now() });
    }
  })();

  return buildProcess;
}

export function apiPlugin(): Plugin {
  return {
    name: 'config-editor-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /api routes
        if (!url.startsWith('/api/')) {
          return next();
        }

        try {
          // GET /api/config/:type
          const configGetMatch = url.match(/^\/api\/config\/(app|theme|plugins|build-env)$/);
          if (configGetMatch && req.method === 'GET') {
            const type = configGetMatch[1];
            const filename = CONFIG_FILES[type];
            const filePath = path.join(constantsDir, filename);

            try {
              const content = await fs.readFile(filePath, 'utf-8');
              sendJson(res, 200, JSON.parse(content));
            } catch {
              sendJson(res, 500, { error: `Failed to read ${filename}` });
            }
            return;
          }

          // PUT /api/config/:type
          if (configGetMatch && req.method === 'PUT') {
            const type = configGetMatch[1];
            const filename = CONFIG_FILES[type];
            const filePath = path.join(constantsDir, filename);
            const body = await readBody(req);

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
              sendJson(res, 400, { error: 'Request body must be a valid JSON object' });
              return;
            }

            // plugins 저장 시 네임스페이스 충돌 검사
            if (type === 'plugins') {
              const validation = validatePluginNamespaces(body);
              if (!validation.valid) {
                sendJson(res, 400, {
                  error: 'Namespace conflict detected',
                  conflicts: validation.conflicts
                });
                return;
              }
            }

            try {
              const content = JSON.stringify(body, null, 2) + '\n';
              await fs.writeFile(filePath, content, 'utf-8');

              if (type === 'plugins') {
                await regeneratePluginRegistry();
              }

              // build-env 저장 시 local.properties도 업데이트
              if (type === 'build-env' && body.android?.sdkPath) {
                try {
                  await updateLocalProperties(body.android.sdkPath);
                } catch (e) {
                  console.log('[api-plugin] Could not update local.properties:', e);
                }
              }

              sendJson(res, 200, { success: true });
            } catch {
              sendJson(res, 500, { error: `Failed to write ${filename}` });
            }
            return;
          }

          // GET /api/plugins/installed
          if (url === '/api/plugins/installed' && req.method === 'GET') {
            console.log('[api-plugin] Fetching installed packages...');
            const packages = await getInstalledPackages();
            console.log('[api-plugin] Found', packages.length, 'installed packages');
            // rnww-plugin-* 만 필터링
            const rnwwPlugins = packages.filter(p => p.name.startsWith('rnww-plugin-'));
            console.log('[api-plugin] RNWW plugins:', rnwwPlugins.map(p => p.name));
            const sorted = packages.sort((a, b) => {
              const aIsRnww = a.name.startsWith('rnww-plugin-');
              const bIsRnww = b.name.startsWith('rnww-plugin-');
              if (aIsRnww && !bIsRnww) return -1;
              if (!aIsRnww && bIsRnww) return 1;
              return a.name.localeCompare(b.name);
            });
            sendJson(res, 200, sorted);
            return;
          }

          // GET /api/plugins/search?q=query
          if (url.startsWith('/api/plugins/search') && req.method === 'GET') {
            console.log('[api-plugin] Search request URL:', url);
            const urlObj = new URL(url, 'http://localhost');
            const query = urlObj.searchParams.get('q') || 'rnww-plugin';
            console.log('[api-plugin] Parsed query:', query);

            if (!isValidSearchQuery(query)) {
              console.log('[api-plugin] Query validation failed');
              sendJson(res, 400, { error: 'Invalid search query' });
              return;
            }

            const results = await searchNpmPackages(query);
            console.log('[api-plugin] Returning', results.length, 'results');
            sendJson(res, 200, results);
            return;
          }

          // POST /api/plugins/install
          if (url === '/api/plugins/install' && req.method === 'POST') {
            const { name, version } = await readBody(req);

            if (!name || !isValidPackageName(name)) {
              sendJson(res, 400, { error: 'Invalid package name' });
              return;
            }

            const result = await installPackage(name, version);
            if (result.success) {
              sendJson(res, 200, { success: true });
            } else {
              sendJson(res, 500, { error: result.error });
            }
            return;
          }

          // POST /api/plugins/uninstall
          if (url === '/api/plugins/uninstall' && req.method === 'POST') {
            const { name } = await readBody(req);

            if (!name || !isValidPackageName(name)) {
              sendJson(res, 400, { error: 'Invalid package name' });
              return;
            }

            const result = await uninstallPackage(name);
            if (result.success) {
              sendJson(res, 200, { success: true });
            } else {
              sendJson(res, 500, { error: result.error });
            }
            return;
          }

          // GET /api/plugins/scan
          if (url === '/api/plugins/scan' && req.method === 'GET') {
            try {
              const entries = await fs.readdir(bridgesDir, { withFileTypes: true });
              const folders = entries
                .filter(entry => entry.isDirectory())
                .map(entry => `./${entry.name}`);
              sendJson(res, 200, folders);
            } catch {
              sendJson(res, 500, { error: 'Failed to scan bridges folder' });
            }
            return;
          }

          // POST /api/plugins/validate - 네임스페이스 충돌 검사
          if (url === '/api/plugins/validate' && req.method === 'POST') {
            const body = await readBody(req);
            const validation = validatePluginNamespaces(body);
            sendJson(res, 200, validation);
            return;
          }

          // ========== Build API ==========

          // GET /api/build/env-check - Environment verification
          if (url === '/api/build/env-check' && req.method === 'GET') {
            const checks = await checkBuildEnvironment();
            sendJson(res, 200, { checks });
            return;
          }

          // POST /api/build/start - Start build
          if (url === '/api/build/start' && req.method === 'POST') {
            const { type, profile } = await readBody(req);
            const buildId = `build-${Date.now()}`;

            try {
              const buildProcess = startBuildProcess(type, profile, buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/build/output/:id - Get build output
          const outputMatch = url.match(/^\/api\/build\/output\/([a-z0-9-]+)$/);
          if (outputMatch && req.method === 'GET') {
            const buildId = outputMatch[1];
            const build = buildProcesses.get(buildId);

            if (!build) {
              sendJson(res, 404, { error: 'Build not found' });
              return;
            }

            // Get new lines since last fetch
            const lines = build.output.splice(0, build.output.length);
            sendJson(res, 200, { lines, finished: build.finished });

            // Clean up finished builds after some time
            if (build.finished) {
              setTimeout(() => buildProcesses.delete(buildId), 60000);
            }
            return;
          }

          // POST /api/build/cancel/:id - Cancel build
          const cancelMatch = url.match(/^\/api\/build\/cancel\/([a-z0-9-]+)$/);
          if (cancelMatch && req.method === 'POST') {
            const buildId = cancelMatch[1];
            const build = buildProcesses.get(buildId);

            if (build && !build.finished) {
              build.process.kill();
              build.finished = true;
              build.output.push({ type: 'info', text: 'Build cancelled by user', timestamp: Date.now() });
            }
            sendJson(res, 200, { success: true });
            return;
          }

          // POST /api/build/clean - Clean Gradle cache
          if (url === '/api/build/clean' && req.method === 'POST') {
            const buildId = `clean-${Date.now()}`;

            try {
              const buildProcess = startCleanProcess(buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/build/deep-clean - Delete android folder and run prebuild
          if (url === '/api/build/deep-clean' && req.method === 'POST') {
            const buildId = `deepclean-${Date.now()}`;

            try {
              const buildProcess = startDeepCleanProcess(buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/build/keystore - Check keystore status
          if (url === '/api/build/keystore' && req.method === 'GET') {
            const keystorePaths = [
              path.join(projectRoot, 'android', 'app', 'release.keystore'),
              path.join(projectRoot, 'android', 'app', 'my-release-key.keystore'),
              path.join(projectRoot, 'android', 'keystores', 'release.keystore')
            ];

            let foundPath: string | null = null;
            for (const p of keystorePaths) {
              if (fsSync.existsSync(p)) {
                foundPath = p;
                break;
              }
            }

            // Check gradle.properties for signing config
            let hasSigningConfig = false;
            const gradlePropsPath = path.join(projectRoot, 'android', 'gradle.properties');
            if (fsSync.existsSync(gradlePropsPath)) {
              const content = fsSync.readFileSync(gradlePropsPath, 'utf-8');
              hasSigningConfig = content.includes('MYAPP_RELEASE_STORE_PASSWORD');
            }

            sendJson(res, 200, {
              exists: !!foundPath,
              path: foundPath,
              hasSigningConfig
            });
            return;
          }

          // POST /api/build/open-folder - Open folder in file explorer
          if (url === '/api/build/open-folder' && req.method === 'POST') {
            const { filePath } = await readBody(req);

            if (!filePath) {
              sendJson(res, 400, { error: 'filePath is required' });
              return;
            }

            // 상대 경로를 절대 경로로 변환
            const absolutePath = path.isAbsolute(filePath)
              ? filePath
              : path.join(projectRoot, filePath);

            // 파일이면 상위 폴더, 폴더면 그대로
            let folderPath = absolutePath;
            if (fsSync.existsSync(absolutePath) && fsSync.statSync(absolutePath).isFile()) {
              folderPath = path.dirname(absolutePath);
            }

            if (!fsSync.existsSync(folderPath)) {
              sendJson(res, 404, { error: 'Folder not found' });
              return;
            }

            try {
              // 플랫폼별 파일 탐색기 열기
              const cmd = process.platform === 'win32'
                ? `explorer "${folderPath}"`
                : process.platform === 'darwin'
                ? `open "${folderPath}"`
                : `xdg-open "${folderPath}"`;

              await execAsync(cmd);
              sendJson(res, 200, { success: true });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/build/download - Download build output file
          if (url.startsWith('/api/build/download') && req.method === 'GET') {
            const urlObj = new URL(url, 'http://localhost');
            const filePath = urlObj.searchParams.get('path');

            if (!filePath) {
              sendJson(res, 400, { error: 'path parameter is required' });
              return;
            }

            // 상대 경로를 절대 경로로 변환
            const absolutePath = path.isAbsolute(filePath)
              ? filePath
              : path.join(projectRoot, filePath);

            // 보안: projectRoot 내부인지 확인
            const normalizedPath = path.normalize(absolutePath);
            if (!normalizedPath.startsWith(projectRoot)) {
              sendJson(res, 403, { error: 'Access denied' });
              return;
            }

            if (!fsSync.existsSync(absolutePath)) {
              sendJson(res, 404, { error: 'File not found' });
              return;
            }

            const stat = fsSync.statSync(absolutePath);
            const filename = path.basename(absolutePath);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', stat.size);

            const stream = fsSync.createReadStream(absolutePath);
            stream.pipe(res);
            return;
          }

          // GET /api/build/output-info - Get info about build output files
          if (url === '/api/build/output-info' && req.method === 'GET') {
            const outputs: Array<{ type: string; path: string; exists: boolean; size?: number; modified?: number }> = [];

            const outputPaths = [
              { type: 'Debug APK', path: 'android/app/build/outputs/apk/debug/app-debug.apk' },
              { type: 'Release APK', path: 'android/app/build/outputs/apk/release/app-release.apk' },
              { type: 'Release AAB', path: 'android/app/build/outputs/bundle/release/app-release.aab' }
            ];

            for (const item of outputPaths) {
              const absolutePath = path.join(projectRoot, item.path);
              if (fsSync.existsSync(absolutePath)) {
                const stat = fsSync.statSync(absolutePath);
                outputs.push({
                  type: item.type,
                  path: item.path,
                  exists: true,
                  size: stat.size,
                  modified: stat.mtimeMs
                });
              } else {
                outputs.push({
                  type: item.type,
                  path: item.path,
                  exists: false
                });
              }
            }

            sendJson(res, 200, { outputs });
            return;
          }

          // POST /api/build/keystore - Generate keystore
          if (url === '/api/build/keystore' && req.method === 'POST') {
            const { alias, storePassword, keyPassword, validity, dname } = await readBody(req);

            // Validate
            if (!alias || !storePassword || storePassword.length < 6) {
              sendJson(res, 400, { error: 'Invalid parameters. Alias required, password must be at least 6 characters.' });
              return;
            }

            const androidAppDir = path.join(projectRoot, 'android', 'app');
            if (!fsSync.existsSync(androidAppDir)) {
              sendJson(res, 400, { error: 'android/app folder not found. Run expo prebuild first.' });
              return;
            }

            const keystorePath = path.join(androidAppDir, 'release.keystore');
            const finalKeyPassword = keyPassword || storePassword;
            const finalValidity = validity || 10000;
            const finalDname = dname || 'CN=Unknown, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=US';

            try {
              // Generate keystore using keytool
              const keytoolCmd = `keytool -genkey -v -keystore "${keystorePath}" -alias "${alias}" -keyalg RSA -keysize 2048 -validity ${finalValidity} -storepass "${storePassword}" -keypass "${finalKeyPassword}" -dname "${finalDname}"`;

              await execAsync(keytoolCmd, { cwd: projectRoot, timeout: 30000 });

              // Update gradle.properties
              const gradlePropsPath = path.join(projectRoot, 'android', 'gradle.properties');
              let gradleProps = '';
              if (fsSync.existsSync(gradlePropsPath)) {
                gradleProps = fsSync.readFileSync(gradlePropsPath, 'utf-8');
                // Remove existing MYAPP_RELEASE settings
                gradleProps = gradleProps.split('\n')
                  .filter(line => !line.startsWith('MYAPP_RELEASE_'))
                  .join('\n');
              }

              // Add new settings
              const signingConfig = `
# Release Keystore settings (auto-generated)
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=${alias}
MYAPP_RELEASE_STORE_PASSWORD=${storePassword}
MYAPP_RELEASE_KEY_PASSWORD=${finalKeyPassword}
`;
              gradleProps = gradleProps.trimEnd() + '\n' + signingConfig;
              fsSync.writeFileSync(gradlePropsPath, gradleProps, 'utf-8');

              sendJson(res, 200, {
                success: true,
                path: keystorePath,
                message: 'Keystore created and gradle.properties updated'
              });
            } catch (error: any) {
              sendJson(res, 500, { error: `Keystore generation failed: ${error.message}` });
            }
            return;
          }

          // Not found
          sendJson(res, 404, { error: 'Not found' });

        } catch (error) {
          console.error('API error:', error);
          sendJson(res, 500, { error: 'Internal server error' });
        }
      });
    }
  };
}
