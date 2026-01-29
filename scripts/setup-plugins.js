const fs = require('fs');
const path = require('path');

/**
 * TypeScript 설정 파일에서 auto 플러그인 정보 추출
 * (간단한 정규식 파싱)
 */
const parsePluginsConfig = (configPath) => {
  const content = fs.readFileSync(configPath, 'utf-8');

  // auto 배열의 시작 위치 찾기
  const autoStart = content.indexOf('auto:');
  if (autoStart === -1) return [];

  // auto: [ 이후부터 파싱 시작
  const afterAuto = content.substring(autoStart);
  const arrayStart = afterAuto.indexOf('[');
  if (arrayStart === -1) return [];

  // 대괄호 매칭으로 배열 끝 찾기
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

  // 각 플러그인 객체 파싱
  const pluginRegex = /{\s*name:\s*['"]([^'"]+)['"]\s*,\s*namespace:\s*['"][^'"]+['"]\s*,\s*keepModules:\s*\[([^\]]*)\]/g;
  let match;

  while ((match = pluginRegex.exec(autoContent)) !== null) {
    const name = match[1];
    const keepModulesStr = match[2];
    const keepModules = keepModulesStr
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(s => s.length > 0);

    plugins.push({ name, keepModules });
  }

  return plugins;
};

// 설정 파일에서 플러그인 정보 로드
const configPath = path.join(__dirname, '..', 'constants', 'plugins.config.ts');
let pluginsToSetup = [];

if (fs.existsSync(configPath)) {
  pluginsToSetup = parsePluginsConfig(configPath);
  console.log(`📋 Loaded ${pluginsToSetup.length} plugins from config`);
} else {
  console.log('⚠️  plugins.config.ts not found, using fallback');
  // 폴백: 기존 하드코딩 목록 (마이그레이션 중 사용)
  pluginsToSetup = [
    { name: 'rnww-plugin-camera', keepModules: ['customcamera'] },
    { name: 'rnww-plugin-microphone', keepModules: ['custommicrophone'] },
    { name: 'rnww-plugin-screen-pinning', keepModules: ['screenpinning'] },
    { name: 'rnww-plugin-background', keepModules: ['custombackground'] },
    { name: 'rnww-plugin-gps', keepModules: ['customgps'] },
    { name: 'rnww-plugin-wifi', keepModules: ['customwifi'] },
    { name: 'rnww-plugin-bluetooth', keepModules: ['custombluetooth'] },
  ];
}

console.log('🔧 Setting up Expo plugins for autolinking...');

pluginsToSetup.forEach(plugin => {
  const pluginPath = path.join(__dirname, '..', 'node_modules', plugin.name);

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

    // keepModules 외 폴더 제거
    const javaModulesPath = path.join(androidDest, 'src', 'main', 'java', 'expo', 'modules');
    if (fs.existsSync(javaModulesPath)) {
      const folders = fs.readdirSync(javaModulesPath);
      folders.forEach(folder => {
        if (!plugin.keepModules.includes(folder)) {
          const folderPath = path.join(javaModulesPath, folder);
          if (fs.statSync(folderPath).isDirectory()) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`   🧹 Removed invalid folder: ${folder}`);
          }
        }
      });
    }

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
