import { cp, mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destination = join(projectRoot, 'public', 'mediapipe', 'wasm');
const runtimeFiles = [
  // The gesture tracker is loaded as an ES module worker. MediaPipe's module
  // runtime is required there so ModuleFactory is registered on globalThis.
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
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

// Tasks Vision 1.2.0 does not ship a module-format no-SIMD loader. Build one
// from its pinned no-SIMD runtime so browsers without WASM SIMD also get the
// global factory expected by the ES module worker.
const noSimdModuleSource = await readFile(join(source, 'vision_wasm_nosimd_internal.js'), 'utf8');
await writeFile(
  join(destination, 'vision_wasm_module_nosimd_internal.js'),
  `${noSimdModuleSource}\n\nglobalThis.ModuleFactory = ModuleFactory;\nexport default ModuleFactory;\n`,
  'utf8'
);
await cp(
  join(source, 'vision_wasm_nosimd_internal.wasm'),
  join(destination, 'vision_wasm_module_nosimd_internal.wasm'),
  { force: true }
);
