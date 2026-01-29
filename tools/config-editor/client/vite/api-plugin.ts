// tools/config-editor/vite/api-plugin.ts
// Vite plugin to handle API routes directly without separate Express server

import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
