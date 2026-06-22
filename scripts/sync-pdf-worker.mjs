// Keeps public/pdf.worker.min.js in sync with the installed pdfjs-dist version.
//
// Why this exists: the PDF worker bundle hard-checks its own version against the
// pdfjs API version at runtime and throws if they differ. public/pdf.worker.min.js
// is served to the browser as a static file, so if pdfjs-dist is ever upgraded
// without refreshing this copy, EVERY PDF upload breaks silently. Running this on
// prebuild and postinstall guarantees the served worker always matches the library.
import { createRequire } from 'node:module';
import { copyFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

try {
  const pkgPath = require.resolve('pdfjs-dist/package.json');
  const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  const src = join(dirname(pkgPath), 'build', 'pdf.worker.min.js');
  const dest = join(process.cwd(), 'public', 'pdf.worker.min.js');

  if (!existsSync(src)) {
    throw new Error(`Worker not found at ${src}`);
  }

  copyFileSync(src, dest);
  console.log(`[sync-pdf-worker] Copied pdf.worker.min.js (pdfjs-dist@${version}) -> public/`);
} catch (err) {
  console.error('[sync-pdf-worker] FAILED to sync PDF worker:', err.message);
  console.error('[sync-pdf-worker] PDF uploads will break until this is resolved.');
  process.exit(1);
}
