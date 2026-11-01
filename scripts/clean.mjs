import { rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildOutput = resolve(projectRoot, 'dist');
const relativePath = relative(projectRoot, buildOutput);

if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
  throw new Error('Refusing to clean a path outside the GestEra project.');
}

await rm(buildOutput, { recursive: true, force: true });
