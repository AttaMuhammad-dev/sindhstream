import { cp, mkdir, access, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destination = join(projectRoot, 'public', 'mediapipe', 'wasm');
const runtimeFiles = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

try {
  await access(source);
} catch {
  throw new Error('MediaPipe Tasks Vision is not installed. Run npm install before starting GestEra.');
}

await mkdir(destination, { recursive: true });
for (const file of runtimeFiles) {
  await access(join(source, file));
  await cp(join(source, file), join(destination, file), { force: true });
}

for (const unusedFile of [
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_module_nosimd_internal.js',
  'vision_wasm_module_nosimd_internal.wasm',
]) {
  try { await unlink(join(destination, unusedFile)); } catch { /* optional stale generated file */ }
}
