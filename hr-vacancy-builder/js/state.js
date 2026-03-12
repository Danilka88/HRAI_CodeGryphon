// ─── SECTION: Imports ───
import { DEFAULT_MODEL, dlog } from "./config.js";

// ─── SECTION: Persistent State ───
const createInitialState = () => ({
  query: "",
  model: DEFAULT_MODEL,
  items: [],
  resumeText: "",
  analysisItems: [],
  activeVacancyId: null,
  activeAnalysisId: null,
  version: 1
});

export const state = createInitialState();

// ─── SECTION: Runtime State ───
let currentScreen = "input";
let lastMarkdown = "";
let lastAnalysisMarkdown = "";
let historyFilter = "all";
let historyRecords = [];
let selectedHistoryEntry = null;

// ─── SECTION: State Helpers ───
const sanitizeRequirementItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.text === "string")
    .map((item, idx) => ({
      id: typeof item.id === "string" ? item.id : `req-${Date.now()}-${idx}`,
      text: item.text.trim(),
      status: item.status === "rejected" ? "rejected" : "approved",
      isEditing: false
    }))
    .filter((item) => item.text);
};

const sanitizeAnalysisItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.text === "string")
    .map((item, idx) => ({
      id: typeof item.id === "string" ? item.id : `analysis-${Date.now()}-${idx}`,
      text: item.text.trim(),
      type: item.type === "weakness" ? "weakness" : "strength",
      isEditing: false
    }))
    .filter((item) => item.text);
};

const hydrateState = (nextState) => {
  state.query = typeof nextState.query === "string" ? nextState.query : "";
  state.model = typeof nextState.model === "string" && nextState.model ? nextState.model : DEFAULT_MODEL;
  state.items = sanitizeRequirementItems(nextState.items);
  state.resumeText = typeof nextState.resumeText === "string" ? nextState.resumeText : "";
  state.analysisItems = sanitizeAnalysisItems(nextState.analysisItems);

  const vacancyId = Number(nextState.activeVacancyId);
  const analysisId = Number(nextState.activeAnalysisId);
  state.activeVacancyId = Number.isInteger(vacancyId) ? vacancyId : null;
  state.activeAnalysisId = Number.isInteger(analysisId) ? analysisId : null;
  state.version = 1;
};

export function saveState() {
  dlog("state", "runtime updated", "items", state.items.length, "analysis", state.analysisItems.length);
}

export function loadState() {
  hydrateState(createInitialState());
}

export function loadVacancyIntoState(record) {
  hydrateState({
    query: typeof record?.query === "string" ? record.query : "",
    model: typeof record?.model === "string" ? record.model : DEFAULT_MODEL,
    items: Array.isArray(record?.items) ? record.items : [],
    resumeText: "",
    analysisItems: [],
    activeVacancyId: Number(record?.id),
    activeAnalysisId: null
  });
}

export function loadAnalysisIntoState(record, linkedVacancyItems = []) {
  hydrateState({
    query: typeof record?.query === "string" ? record.query : "",
    model: typeof record?.model === "string" ? record.model : DEFAULT_MODEL,
    items: Array.isArray(linkedVacancyItems) ? linkedVacancyItems : [],
    resumeText: typeof record?.resumeText === "string" ? record.resumeText : "",
    analysisItems: Array.isArray(record?.analysisItems) ? record.analysisItems : [],
    activeVacancyId: Number.isInteger(Number(record?.vacancyId)) ? Number(record.vacancyId) : null,
    activeAnalysisId: Number(record?.id)
  });
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

export function getHistoryFilter() {
  return historyFilter;
}

export function setHistoryFilter(value) {
  historyFilter = value === "vacancies" || value === "analyses" ? value : "all";
}

export function getHistoryRecords() {
  return historyRecords;
}

export function setHistoryRecords(records) {
  historyRecords = Array.isArray(records) ? records : [];
}

export function getSelectedHistoryEntry() {
  return selectedHistoryEntry;
}

export function setSelectedHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    selectedHistoryEntry = null;
    return;
  }

  const normalizedId = Number(entry.id);
  if (!Number.isInteger(normalizedId) || (entry.kind !== "vacancy" && entry.kind !== "analysis")) {
    selectedHistoryEntry = null;
    return;
  }

  selectedHistoryEntry = {
    id: normalizedId,
    kind: entry.kind
  };
}

export function resetRuntimeState() {
  currentScreen = "input";
  lastMarkdown = "";
  lastAnalysisMarkdown = "";
  selectedHistoryEntry = null;
}
