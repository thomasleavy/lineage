const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const tmpDir = path.join(os.tmpdir(), `lineage-ghpages-${Date.now()}`);

const exclude = new Set(['node_modules', '.next', 'out', '.git', 'playwright-report', 'test-results', '.env']);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (exclude.has(name)) continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  console.log('Copying project to temp dir (excluding node_modules, .next, ...)...');
  copyRecursive(root, tmpDir);
  const apiDir = path.join(tmpDir, 'src', 'app', 'api');
  if (fs.existsSync(apiDir)) {
    console.log('Removing src/app/api for static export...');
    fs.rmSync(apiDir, { recursive: true });
  }
  console.log('Installing dependencies in temp dir...');
  execSync('npm install', { cwd: tmpDir, stdio: 'inherit' });
  console.log('Running next build...');
  execSync('npm run build', {
    cwd: tmpDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_BASE_PATH: '/lineage',
      NEXT_PUBLIC_STATIC_EXPORT: '1',
    },
  });
  const outDir = path.join(root, 'out');
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.cpSync(path.join(tmpDir, 'out'), outDir, { recursive: true });
  // GitHub Pages serves at /lineage/ so assets must live at lineage/_next/ (HTML references /lineage/_next/...)
  const lineageDir = path.join(outDir, 'lineage');
  const nextAtRoot = path.join(outDir, '_next');
  if (fs.existsSync(nextAtRoot) && fs.existsSync(lineageDir)) {
    fs.renameSync(nextAtRoot, path.join(lineageDir, '_next'));
    console.log('Moved _next into lineage/ for correct asset URLs.');
  }
  console.log('Static export written to ./out');
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, maxRetries: 3 });
  } catch (_) {}
}
