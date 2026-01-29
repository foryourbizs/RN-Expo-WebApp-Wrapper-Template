// tools/config-editor/vite/api-plugin.ts
// Vite plugin to handle API routes directly without separate Express server

import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  plugins: 'plugins.json'
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

// ========== Build Functions ==========

async function checkBuildEnvironment(): Promise<Array<{ name: string; status: string; message: string; detail?: string }>> {
  const checks: Array<{ name: string; status: string; message: string; detail?: string }> = [];

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

  // 3. Java
  try {
    const { stderr } = await execAsync('java -version');
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
    checks.push({ name: 'Java', status: 'error', message: 'Not installed', detail: 'Install JDK 17+' });
  }

  // 4. JAVA_HOME
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    checks.push({ name: 'JAVA_HOME', status: 'ok', message: javaHome });
  } else {
    checks.push({ name: 'JAVA_HOME', status: 'warning', message: 'Not set' });
  }

  // 5. Android SDK
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome && fsSync.existsSync(path.join(androidHome, 'platform-tools'))) {
    checks.push({ name: 'Android SDK', status: 'ok', message: androidHome });
  } else if (androidHome) {
    checks.push({ name: 'Android SDK', status: 'warning', message: androidHome, detail: 'platform-tools missing' });
  } else {
    checks.push({ name: 'Android SDK', status: 'error', message: 'Not found', detail: 'Set ANDROID_HOME' });
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

function startBuildProcess(type: string, profile: string, buildId: string): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  let cmd: string;
  let args: string[];

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

function startCleanProcess(buildId: string): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  output.push({ type: 'info', text: 'Cleaning Gradle cache...', timestamp: Date.now() });

  const cmd = process.platform === 'win32' ? 'cmd' : 'sh';
  const cleanScript = process.platform === 'win32'
    ? 'cd android && .\\gradlew --stop && .\\gradlew clean'
    : 'cd android && ./gradlew --stop && ./gradlew clean';
  const args = process.platform === 'win32' ? ['/c', cleanScript] : ['-c', cleanScript];

  const proc = spawn(cmd, args, {
    cwd: projectRoot,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  const buildProcess: BuildProcess = { process: proc, output, finished: false };

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
    } else {
      output.push({ type: 'error', text: `Clean failed with exit code ${code}`, timestamp: Date.now() });
    }
  });

  proc.on('error', (err) => {
    buildProcess.finished = true;
    output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
  });

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
          const configGetMatch = url.match(/^\/api\/config\/(app|theme|plugins)$/);
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

            try {
              const content = JSON.stringify(body, null, 2) + '\n';
              await fs.writeFile(filePath, content, 'utf-8');

              if (type === 'plugins') {
                await regeneratePluginRegistry();
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
