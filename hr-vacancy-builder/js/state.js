// ─── SECTION: Imports ───
import { DEFAULT_MODEL, STORAGE_KEY, dlog } from "./config.js";

// ─── SECTION: Persistent State ───
const createInitialState = () => ({
  query: "",
  model: DEFAULT_MODEL,
  items: [],
  resumeText: "",
  analysisItems: [],
  version: 1
});

export const state = createInitialState();

// ─── SECTION: Runtime State ───
let currentScreen = "input";
let lastMarkdown = "";
let lastAnalysisMarkdown = "";

// ─── SECTION: State Helpers ───
const hydrateState = (nextState) => {
  state.query = nextState.query;
  state.model = nextState.model;
  state.items = nextState.items;
  state.resumeText = nextState.resumeText;
  state.analysisItems = nextState.analysisItems;
  state.version = 1;
};

export function saveState(showError = null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_error) {
    if (typeof showError === "function") {
      showError("Cannot save your progress to localStorage. Please free storage and retry.");
    }
  }
}

export function loadState(showError = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.model = DEFAULT_MODEL;
      return;
    }

    const parsed = JSON.parse(raw);
    const nextState = {
      query: typeof parsed?.query === "string" ? parsed.query : "",
      model: typeof parsed?.model === "string" && parsed.model ? parsed.model : DEFAULT_MODEL,
      items: Array.isArray(parsed?.items)
        ? parsed.items
          .filter((item) => item && typeof item.text === "string")
          .map((item, idx) => ({
            id: typeof item.id === "string" ? item.id : `saved-${idx}-${Date.now()}`,
            text: item.text.trim(),
            status: item.status === "rejected" ? "rejected" : "approved",
            isEditing: false
          }))
          .filter((item) => item.text)
        : [],
      resumeText: typeof parsed?.resumeText === "string" ? parsed.resumeText : "",
      analysisItems: Array.isArray(parsed?.analysisItems)
        ? parsed.analysisItems
          .filter((item) => item && typeof item.text === "string")
          .map((item, idx) => ({
            id: typeof item.id === "string" ? item.id : `analysis-saved-${idx}-${Date.now()}`,
            type: item.type === "weakness" ? "weakness" : "strength",
            text: item.text.trim(),
            isEditing: false
          }))
          .filter((item) => item.text)
        : [],
      version: 1
    };

    hydrateState(nextState);
  } catch (_error) {
    dlog("state", "restore failed, resetting storage payload");
    hydrateState(createInitialState());
    saveState(showError);
  }
}

export function resetState() {
  hydrateState(createInitialState());
}

// ─── SECTION: Runtime Getters/Setters ───
export function getCurrentScreen() {
  return currentScreen;
}

export function setCurrentScreen(screen) {
  currentScreen = screen;
}

export function getLastMarkdown() {
  return lastMarkdown;
}

export function setLastMarkdown(value) {
  lastMarkdown = typeof value === "string" ? value : "";
}

export function getLastAnalysisMarkdown() {
  return lastAnalysisMarkdown;
}

export function setLastAnalysisMarkdown(value) {
  lastAnalysisMarkdown = typeof value === "string" ? value : "";
}

export function resetRuntimeState() {
  currentScreen = "input";
  lastMarkdown = "";
  lastAnalysisMarkdown = "";
}
