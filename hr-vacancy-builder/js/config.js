// ─── SECTION: Constants & Config ───
export const OLLAMA_URL = "http://localhost:11434";
export const FALLBACK_OLLAMA_URL = "http://127.0.0.1:11434";
export const STORAGE_KEY = "hr-vacancy-builder";
export const DEFAULT_MODEL = "qwen3.5:4b";
export const GENERATE_TIMEOUT_MS = 180000;

// ─── SECTION: Logging ───
export const DEBUG = true;
export const LOG_PREFIX = "[HR-VB]";

export const dlog = (...args) => {
  if (DEBUG) {
    console.log(LOG_PREFIX, ...args);
  }
};

export const dwarn = (...args) => {
  if (DEBUG) {
    console.warn(LOG_PREFIX, ...args);
  }
};

export const derror = (...args) => {
  if (DEBUG) {
    console.error(LOG_PREFIX, ...args);
  }
};
