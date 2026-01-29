// tools/config-editor/vite/api-plugin.ts
// Vite plugin to handle API routes directly without separate Express server

import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
  if (!isValidSearchQuery(query)) return [];
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const { stdout } = await execFileAsync(npmCmd, ['search', query, '--json'], {
      cwd: projectRoot,
      timeout: 30000
    });
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

async function getInstalledPackages() {
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const { stdout } = await execFileAsync(npmCmd, ['list', '--json', '--depth=0'], {
      cwd: projectRoot
    });
    const data = JSON.parse(stdout);
    return Object.entries(data.dependencies || {}).map(([name, info]: [string, any]) => ({
      name,
      version: info.version
    }));
  } catch (error: any) {
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
    return [];
  }
}

async function installPackage(packageName: string, version = 'latest') {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }
  const spec = version === 'latest' ? packageName : `${packageName}@${version}`;
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await execFileAsync(npmCmd, ['install', spec], { cwd: projectRoot, timeout: 120000 });
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
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await execFileAsync(npmCmd, ['uninstall', packageName], { cwd: projectRoot, timeout: 60000 });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function regeneratePluginRegistry() {
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await execFileAsync(npmCmd, ['run', 'generate:plugins'], { cwd: projectRoot });
    console.log('Plugin registry regenerated');
  } catch (e) {
    console.error('Failed to regenerate plugin registry:', e);
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
            const packages = await getInstalledPackages();
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
            const urlObj = new URL(url, 'http://localhost');
            const query = urlObj.searchParams.get('q') || 'rnww-plugin';

            if (!isValidSearchQuery(query)) {
              sendJson(res, 400, { error: 'Invalid search query' });
              return;
            }

            const results = await searchNpmPackages(query);
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
