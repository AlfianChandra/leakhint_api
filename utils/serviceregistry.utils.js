class ServiceRegistry {
  constructor() {
    this.store = new Map();
    this.waiters = new Map();
  }

  register(name, value) {
    if (!name) throw new Error("Service name is required");
    this.store.set(name, value);

    if (this.waiters.has(name)) {
      for (const resolve of this.waiters.get(name)) resolve(value);
      this.waiters.delete(name);
    }
  }

  unregister(name) {
    if (!this.store.has(name)) {
      throw new Error(`Service "${name}" not registered`);
    }

    this.store.delete(name);

    if (this.waiters.has(name)) {
      for (const resolve of this.waiters.get(name)) {
        try {
          resolve(Promise.reject(new Error(`Service "${name}" unregistered`)));
        } catch (_) {}
      }
      this.waiters.delete(name);
    }
  }

  get(name) {
    if (!this.store.has(name)) {
      throw new Error(`Service "${name}" not registered`);
    }
    return this.store.get(name);
  }

  tryGet(name) {
    return this.store.get(name);
  }

  has(name) {
    return this.store.has(name);
  }

  waitFor(name, { timeoutMs = 15000 } = {}) {
    if (this.store.has(name)) return Promise.resolve(this.store.get(name));

    return new Promise((resolve, reject) => {
      const list = this.waiters.get(name) || [];
      list.push(resolve);
      this.waiters.set(name, list);

      if (timeoutMs > 0) {
        const t = setTimeout(() => {
          const arr = this.waiters.get(name) || [];
          this.waiters.set(
            name,
            arr.filter((fn) => fn !== resolve)
          );
          reject(new Error(`Timeout waiting for service "${name}"`));
        }, timeoutMs);

        const origResolve = resolve;
        resolve = (v) => {
          clearTimeout(t);
          origResolve(v);
        };
      }
    });
  }

  snapshot() {
    return Object.fromEntries(this.store.entries());
  }
}

const registry = new ServiceRegistry();
export default registry;
