import { rm } from 'node:fs/promises';

for (const path of ['packages/shared/dist', 'apps/client/dist', 'apps/server/dist']) {
  await rm(path, { recursive: true, force: true });
}
