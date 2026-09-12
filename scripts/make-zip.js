import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputZip = path.join(rootDir, 'e-casevault-clean-share.zip');

console.log('============================================================================');
console.log(' Packaging e-CASEVAULT for Sharing / Antigravity');
console.log(' Project Directory: ', rootDir);
console.log(' Output ZIP Target:  ', outputZip);
console.log('============================================================================');

// Ensure placeholders exist
const placeholders = [
  'storage/evidence/.gitkeep',
  'storage/keys/.gitkeep',
  'storage/case_repo/.gitkeep',
  'storage/quarantine/.gitkeep',
  'storage/fabric-identities/.gitkeep'
];

for (const p of placeholders) {
  const full = path.join(rootDir, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, '');
  }
}

// Remove old zip if it exists
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

const isWindows = process.platform === 'win32';

if (!isWindows) {
  // Use Unix zip
  const excludePatterns = [
    'node_modules/*',
    '*/node_modules/*',
    'dist/*',
    '*/dist/*',
    'build/*',
    'coverage/*',
    '.git/*',
    '*.zip',
    '.env',
    '.env.local',
    '.env.production',
    'storage/evidence/*.enc',
    'storage/case_repo/*',
    'storage/keys/*.pem',
    'storage/fabric-identities/*.id',
    '*.log',
    '.DS_Store',
    '*/.DS_Store',
    '__MACOSX/*',
    '*/__MACOSX/*',
    '.claude/*',
    '*/.claude/*'
  ];

  const excludeArgs = excludePatterns.map(p => `-x "${p}"`).join(' ');
  const cmd = `zip -r "${outputZip}" . ${excludeArgs}`;

  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    // Re-add required files
    execSync(`zip "${outputZip}" .env.example storage/evidence/.gitkeep storage/case_repo/.gitkeep storage/keys/.gitkeep storage/fabric-identities/.gitkeep`, { cwd: rootDir, stdio: 'ignore' });
  } catch (err) {
    console.error('Error creating ZIP with zip CLI:', err.message);
    process.exit(1);
  }
} else {
  // PowerShell Compress-Archive for Windows
  const psCmd = `powershell -Command "Get-ChildItem -Path . -Exclude node_modules,dist,build,coverage,.git,*.zip,.env,.claude | Compress-Archive -DestinationPath '${outputZip}' -Force"`;
  try {
    execSync(psCmd, { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.error('Error creating ZIP with PowerShell:', err.message);
    process.exit(1);
  }
}

if (fs.existsSync(outputZip)) {
  const downloadsZip = path.join('/Users/sujalpujari/Downloads', 'e-casevault-clean-share.zip');
  try {
    fs.copyFileSync(outputZip, downloadsZip);
  } catch (e) {
    // ignore if copy fails
  }

  const stats = fs.statSync(outputZip);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('============================================================================');
  console.log(`✅ SUCCESS! Shareable clean ZIP created:`);
  console.log(`📁 In Project:   ${outputZip}`);
  console.log(`📁 In Downloads: ${downloadsZip}`);
  console.log(`📦 Size: ${sizeMB} MB (Clean, NO node_modules, 100% portable)`);
  console.log('============================================================================');
  console.log('👉 Send "e-casevault-clean-share.zip" to your friend.');
  console.log('   When they extract it:');
  console.log('   - Windows: Double-click "START-WINDOWS.bat"');
  console.log('   - Mac: Double-click "START-MAC.command"');
  console.log('   - Or run "npm install" then "npm start" in terminal');
  console.log('============================================================================');
} else {
  console.error('❌ Failed to produce output zip.');
  process.exit(1);
}
