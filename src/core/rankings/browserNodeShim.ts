// Browser-safe node shims for path and fs in browser runtime.
export const resolve = (...args: string[]) => args.filter(Boolean).join('/').replace(/\/+/g, '/');
export const join = (...args: string[]) => args.filter(Boolean).join('/').replace(/\/+/g, '/');
export const dirname = (p: string) => p.split('/').slice(0, -1).join('/') || '.';
export const basename = (p: string) => p.split('/').pop() || '';
export const extname = (p: string) => {
  const base = basename(p);
  const idx = base.lastIndexOf('.');
  return idx === -1 ? '' : base.slice(idx);
};
export const existsSync = () => false;
export const readFileSync = () => '';
export const writeFileSync = () => {};

export default {
  resolve,
  join,
  dirname,
  basename,
  extname,
  existsSync,
  readFileSync,
  writeFileSync
};
