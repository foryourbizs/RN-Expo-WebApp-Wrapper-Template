// tools/config-editor/server/routes/config.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const constantsDir = path.resolve(__dirname, '../../../../constants');
const projectRoot = path.resolve(__dirname, '../../../..');

const router = express.Router();

// 설정 파일 목록
const CONFIG_FILES = {
  app: 'app.json',
  theme: 'theme.json',
  plugins: 'plugins.json'
};

// GET /api/config/defaults/:type - 기본값 읽기 (TypeScript 파일에서)
// 주의: 이 라우트는 /:type 라우트보다 먼저 정의되어야 함
router.get('/defaults/:type', async (req, res) => {
  const { type } = req.params;

  // TypeScript 기본값은 클라이언트에서 하드코딩
  // 또는 별도의 defaults.json 파일 생성 필요
  res.status(501).json({ error: 'Not implemented - use client defaults' });
});

// GET /api/config/:type - 설정 파일 읽기
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  const filename = CONFIG_FILES[type];

  if (!filename) {
    return res.status(400).json({ error: 'Invalid config type' });
  }

  const filePath = path.join(constantsDir, filename);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    try {
      res.json(JSON.parse(content));
    } catch (parseError) {
      console.error(`JSON parse error in ${filename}:`, parseError);
      res.status(500).json({ error: `Invalid JSON format in ${filename}` });
    }
  } catch (error) {
    console.error(`Failed to read ${filename}:`, error);
    res.status(500).json({ error: `Failed to read ${filename}` });
  }
});

// PUT /api/config/:type - 설정 파일 저장
router.put('/:type', async (req, res) => {
  const { type } = req.params;
  const filename = CONFIG_FILES[type];

  if (!filename) {
    return res.status(400).json({ error: 'Invalid config type' });
  }

  // 요청 본문 검증
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a valid JSON object' });
  }

  try {
    const filePath = path.join(constantsDir, filename);
    const content = JSON.stringify(req.body, null, 2) + '\n';
    await fs.writeFile(filePath, content, 'utf-8');

    // plugins.json 저장 시 레지스트리 재생성
    if (type === 'plugins') {
      try {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        await execFileAsync(npmCmd, ['run', 'generate:plugins'], { cwd: projectRoot });
        console.log('Plugin registry regenerated');
      } catch (e) {
        console.error('Failed to regenerate plugin registry:', e);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to write ${filename}:`, error);
    res.status(500).json({ error: `Failed to write ${filename}` });
  }
});

export default router;
