const PREFIX = "eu-model-catalog:";

/** A piece of state mirrored to localStorage under `key`. */
export function persisted<T>(key: string, initial: T): { value: T } {
  let value = $state<T>(load(key, initial));
  return {
    get value() {
      return value;
    },
    set value(v: T) {
      value = v;
      localStorage.setItem(PREFIX + key, JSON.stringify(v));
    },
  };
}

function load<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}
