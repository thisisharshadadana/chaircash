const memory = new Map<string, string>();

const storageShim = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(k: string) {
    return memory.has(k) ? (memory.get(k) as string) : null;
  },
  setItem(k: string, v: string) {
    memory.set(k, String(v));
  },
  removeItem(k: string) {
    memory.delete(k);
  },
  key(i: number) {
    return Array.from(memory.keys())[i] ?? null;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storageShim,
  configurable: true,
  writable: true,
});
