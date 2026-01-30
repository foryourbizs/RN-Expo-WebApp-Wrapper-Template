const fs = require('fs');
const path = require('path');

/**
 * plugins.json에서 auto 플러그인 목록 로드
 */
const loadPluginsFromJson = (jsonPath) => {
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const config = JSON.parse(content);
    return config.plugins?.auto || [];
  } catch (e) {
    console.log('⚠️  Failed to parse plugins.json:', e.message);
    return [];
  }
};

/**
 * plugins.config.ts에서 auto 플러그인 정보 추출 (fallback)
 */
const parsePluginsConfigTs = (configPath) => {
  const content = fs.readFileSync(configPath, 'utf-8');
  const autoStart = content.indexOf('auto:');
  if (autoStart === -1) return [];

  const afterAuto = content.substring(autoStart);
  const arrayStart = afterAuto.indexOf('[');
  if (arrayStart === -1) return [];

  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < afterAuto.length; i++) {
    if (afterAuto[i] === '[') depth++;
    if (afterAuto[i] === ']') depth--;
    if (depth === 0) {
      arrayEnd = i;
      break;
    }
  }

  if (arrayEnd === -1) return [];

  const autoContent = afterAuto.substring(arrayStart + 1, arrayEnd);
  const plugins = [];
  const pluginRegex = /{\s*name:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = pluginRegex.exec(autoContent)) !== null) {
    plugins.push({ name: match[1] });
  }

  return plugins;
};

// 설정 파일에서 플러그인 정보 로드
const jsonPath = path.join(__dirname, '..', 'constants', 'plugins.json');
const tsPath = path.join(__dirname, '..', 'constants', 'plugins.config.ts');
let pluginsToSetup = [];

// plugins.json 우선, 없으면 plugins.config.ts
if (fs.existsSync(jsonPath)) {
  pluginsToSetup = loadPluginsFromJson(jsonPath);
  console.log(`📋 Loaded ${pluginsToSetup.length} plugins from plugins.json`);
} else if (fs.existsSync(tsPath)) {
  pluginsToSetup = parsePluginsConfigTs(tsPath);
  console.log(`📋 Loaded ${pluginsToSetup.length} plugins from plugins.config.ts`);
} else {
  console.log('⚠️  No plugin config found');
}

const enabledPluginNames = pluginsToSetup.map(p => p.name);

// 네임스페이스 충돌 검사
const checkNamespaceConflicts = () => {
  const jsonPath = path.join(__dirname, '..', 'constants', 'plugins.json');
  if (!fs.existsSync(jsonPath)) return;

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const config = JSON.parse(content);
    const allPlugins = [
      ...(config.plugins?.auto || []).map(p => ({ ...p, type: 'auto' })),
      ...(config.plugins?.manual || []).map(p => ({ ...p, type: 'manual' }))
    ];

    const namespaceMap = new Map();
    const conflicts = [];

    allPlugins.forEach(plugin => {
      const ns = plugin.namespace;
      const id = plugin.name || plugin.path;

      if (namespaceMap.has(ns)) {
        conflicts.push({
          namespace: ns,
          plugins: [namespaceMap.get(ns), id]
        });
      } else {
        namespaceMap.set(ns, id);
      }
    });

    if (conflicts.length > 0) {
      console.log('');
      console.log('⚠️  Namespace conflicts detected:');
      conflicts.forEach(c => {
        console.log(`   "${c.namespace}" is used by: ${c.plugins.join(', ')}`);
      });
      console.log('');
      console.log('   Please use unique namespaces for each plugin.');
      console.log('');
    }
  } catch (e) {
    // ignore
  }
};

checkNamespaceConflicts();
console.log('🔧 Setting up Expo plugins for autolinking...');

// node_modules에서 rnww-plugin-* 패키지 찾기
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
const allRnwwPlugins = fs.readdirSync(nodeModulesPath)
  .filter(name => name.startsWith('rnww-plugin-'));

// 비활성 플러그인에서 expo-module.config.json 제거 (autolinking 방지)
allRnwwPlugins.forEach(pluginName => {
  if (!enabledPluginNames.includes(pluginName)) {
    const pluginPath = path.join(nodeModulesPath, pluginName);
    const configFile = path.join(pluginPath, 'expo-module.config.json');
    const androidFolder = path.join(pluginPath, 'android');
    const iosFolder = path.join(pluginPath, 'ios');

    // expo-module.config.json 제거
    if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
      console.log(`🚫 ${pluginName}: disabled (expo-module.config.json removed)`);
    }

    // android 폴더 제거
    if (fs.existsSync(androidFolder)) {
      fs.rmSync(androidFolder, { recursive: true, force: true });
    }

    // ios 폴더 제거
    if (fs.existsSync(iosFolder)) {
      fs.rmSync(iosFolder, { recursive: true, force: true });
    }
  }
});

// 활성 플러그인 설정
pluginsToSetup.forEach(plugin => {
  const pluginPath = path.join(nodeModulesPath, plugin.name);

  if (!fs.existsSync(pluginPath)) {
    console.log(`⚠️  ${plugin.name} not found, skipping...`);
    return;
  }

  // expo-module.config.json 복사
  const configSource = path.join(pluginPath, 'src', 'modules', 'expo-module.config.json');
  const configDest = path.join(pluginPath, 'expo-module.config.json');

  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, configDest);
    console.log(`✅ ${plugin.name}: expo-module.config.json copied`);
  }

  // android 폴더 복사
  const androidSource = path.join(pluginPath, 'src', 'modules', 'android');
  const androidDest = path.join(pluginPath, 'android');

  if (fs.existsSync(androidSource)) {
    if (fs.existsSync(androidDest)) {
      fs.rmSync(androidDest, { recursive: true, force: true });
    }
    fs.cpSync(androidSource, androidDest, { recursive: true });
    console.log(`✅ ${plugin.name}: android folder copied`);
  }

  // ios 폴더 복사
  const iosSource = path.join(pluginPath, 'src', 'modules', 'ios');
  const iosDest = path.join(pluginPath, 'ios');

  if (fs.existsSync(iosSource)) {
    if (fs.existsSync(iosDest)) {
      fs.rmSync(iosDest, { recursive: true, force: true });
    }
    fs.cpSync(iosSource, iosDest, { recursive: true });
    console.log(`✅ ${plugin.name}: ios folder copied`);
  }
});

console.log('✨ Plugin setup complete!');
