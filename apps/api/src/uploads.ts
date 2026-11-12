import { mkdirSync } from 'fs';
import { join } from 'path';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const AVATARS_DIR = join(UPLOADS_DIR, 'avatars');

export function ensureUploadDirs() {
  mkdirSync(AVATARS_DIR, { recursive: true });
}
