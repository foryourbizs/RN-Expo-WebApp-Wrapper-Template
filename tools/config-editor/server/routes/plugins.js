// tools/config-editor/server/routes/plugins.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  searchNpmPackages,
  getInstalledPackages,
  installPackage,
  uninstallPackage,
  isValidPackageName,
  isValidSearchQuery
} from '../utils/npm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgesDir = path.resolve(__dirname, '../../../../lib/bridges');

const router = express.Router();

// GET /api/plugins/installed - 설치된 npm 패키지 목록
router.get('/installed', async (req, res) => {
  try {
    const packages = await getInstalledPackages();
    // rnww-plugin-* 패키지 우선 정렬
    const sorted = packages.sort((a, b) => {
      const aIsRnww = a.name.startsWith('rnww-plugin-');
      const bIsRnww = b.name.startsWith('rnww-plugin-');
      if (aIsRnww && !bIsRnww) return -1;
      if (!aIsRnww && bIsRnww) return 1;
      return a.name.localeCompare(b.name);
    });
    res.json(sorted);
  } catch (error) {
    console.error('Failed to get installed packages:', error);
    res.status(500).json({ error: 'Failed to get installed packages' });
  }
});

// GET /api/plugins/search?q=query - npm 패키지 검색
router.get('/search', async (req, res) => {
  const query = req.query.q || 'rnww-plugin';

  // 검색 쿼리 유효성 검사
  if (!isValidSearchQuery(query)) {
    return res.status(400).json({ error: 'Invalid search query' });
  }

  try {
    const results = await searchNpmPackages(query);
    res.json(results);
  } catch (error) {
    console.error('Failed to search packages:', error);
    res.status(500).json({ error: 'Failed to search packages' });
  }
});

// POST /api/plugins/install - 패키지 설치
router.post('/install', async (req, res) => {
  const { name, version } = req.body;

  // 패키지 이름 유효성 검사
  if (!name || !isValidPackageName(name)) {
    return res.status(400).json({ error: 'Invalid package name' });
  }

  const result = await installPackage(name, version);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// POST /api/plugins/uninstall - 패키지 제거
router.post('/uninstall', async (req, res) => {
  const { name } = req.body;

  // 패키지 이름 유효성 검사
  if (!name || !isValidPackageName(name)) {
    return res.status(400).json({ error: 'Invalid package name' });
  }

  const result = await uninstallPackage(name);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// GET /api/plugins/scan - lib/bridges 폴더 스캔
router.get('/scan', async (req, res) => {
  try {
    const entries = await fs.readdir(bridgesDir, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => `./${entry.name}`);
    res.json(folders);
  } catch (error) {
    console.error('Failed to scan bridges folder:', error);
    res.status(500).json({ error: 'Failed to scan bridges folder' });
  }
});

export default router;
