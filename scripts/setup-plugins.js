const fs = require('fs');
const path = require('path');

const pluginsToSetup = [
  'rnww-plugin-camera',
  'rnww-plugin-microphone',
  'rnww-plugin-screen-pinning'
];

console.log('🔧 Setting up Expo plugins for autolinking...');

pluginsToSetup.forEach(pluginName => {
  const pluginPath = path.join(__dirname, '..', 'node_modules', pluginName);
  
  if (!fs.existsSync(pluginPath)) {
    console.log(`⚠️  ${pluginName} not found, skipping...`);
    return;
  }

  // Copy expo-module.config.json to package root
  const configSource = path.join(pluginPath, 'src', 'modules', 'expo-module.config.json');
  const configDest = path.join(pluginPath, 'expo-module.config.json');
  
  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, configDest);
    console.log(`✅ ${pluginName}: expo-module.config.json copied`);
  }

  // Copy android folder to package root
  const androidSource = path.join(pluginPath, 'src', 'modules', 'android');
  const androidDest = path.join(pluginPath, 'android');
  
  if (fs.existsSync(androidSource) && !fs.existsSync(androidDest)) {
    fs.cpSync(androidSource, androidDest, { recursive: true });
    console.log(`✅ ${pluginName}: android folder copied`);
  }

  // Copy ios folder to package root
  const iosSource = path.join(pluginPath, 'src', 'modules', 'ios');
  const iosDest = path.join(pluginPath, 'ios');
  
  if (fs.existsSync(iosSource) && !fs.existsSync(iosDest)) {
    fs.cpSync(iosSource, iosDest, { recursive: true });
    console.log(`✅ ${pluginName}: ios folder copied`);
  }
});

console.log('✨ Plugin setup complete!');
