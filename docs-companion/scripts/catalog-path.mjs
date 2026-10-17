import path from 'node:path';

// Convert filesystem-relative paths at the boundary before classifying or making URLs.
export function articleUrl(root, file, filesystemPath = path) {
  const relativePath = filesystemPath.relative(root, file).replaceAll('\\', '/');
  if (!relativePath.startsWith('wiki/') || relativePath.includes('/images/') || !relativePath.endsWith('.html')) return null;
  return 'site/' + relativePath;
}
