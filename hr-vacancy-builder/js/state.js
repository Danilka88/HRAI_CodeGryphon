// ─── SECTION: Imports ───
import { DEFAULT_MODEL, derror, dlog } from "./config.js";

// ─── SECTION: Constants ───
const HH_SETTINGS_STORAGE_KEY = "hrvb_hh_settings_v1";

// ─── SECTION: Persistent State ───
const createInitialState = () => ({
  query: "",
  model: DEFAULT_MODEL,
  items: [],
  resumeText: "",
  analysisItems: [],
  activeVacancyId: null,
  activeAnalysisId: null,
  hhUseDemo: true,
  hhApiKey: "",
  hhSearchQuery: "NAME:Python",
  hhArea: 1,
  hhPerPage: 20,
  hhResumes: [],
  hhSelectedResumeId: "",
  hhNotice: "",
  compensationQuery: "",
  compensationModel: DEFAULT_MODEL,
  compensationResult: {
    salaryRange: "",
    companyConditions: "",
    hiringRecommendations: ""
  },
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
let bestVersionResult = null;

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

const sanitizeHhResumes = (resumes) => {
  if (!Array.isArray(resumes)) {
    return [];
  }

  return resumes
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        title: typeof item.title === "string" ? item.title.trim() : "",
        employer: typeof item.employer === "string" ? item.employer.trim() : "",
        area: typeof item.area === "string" ? item.area.trim() : "",
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt.trim() : "",
        url: typeof item.url === "string" ? item.url.trim() : "",
        resumeText: typeof item.resumeText === "string" ? item.resumeText.trim() : "",
        index
      };
    })
    .filter(Boolean);
};

const sanitizeCompensationResult = (result) => {
  const safe = result && typeof result === "object" ? result : {};
  return {
    salaryRange: typeof safe.salaryRange === "string" ? safe.salaryRange.trim() : "",
    companyConditions: typeof safe.companyConditions === "string" ? safe.companyConditions.trim() : "",
    hiringRecommendations: typeof safe.hiringRecommendations === "string" ? safe.hiringRecommendations.trim() : ""
  };
};

const sanitizeHhSettings = (value) => {
  const settings = value && typeof value === "object" ? value : {};
  const area = Number(settings.area);
  const perPage = Number(settings.perPage);

  return {
    useDemo: settings.useDemo !== false,
    searchQuery: typeof settings.searchQuery === "string" && settings.searchQuery.trim()
      ? settings.searchQuery.trim()
      : "NAME:Python",
    area: Number.isInteger(area) && area > 0 ? area : 1,
    perPage: Number.isInteger(perPage) && perPage >= 1 ? Math.min(perPage, 100) : 20
  };
};

const saveHhSettings = () => {
  const payload = {
    useDemo: state.hhUseDemo,
    searchQuery: state.hhSearchQuery,
    area: state.hhArea,
    perPage: state.hhPerPage
  };

  try {
    window.localStorage.setItem(HH_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown localStorage error";
    derror("state", "failed to save hh settings", msg);
  }
};

const restoreHhSettings = () => {
  try {
    const raw = window.localStorage.getItem(HH_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeHhSettings(parsed);
    state.hhUseDemo = sanitized.useDemo;
    state.hhSearchQuery = sanitized.searchQuery;
    state.hhArea = sanitized.area;
    state.hhPerPage = sanitized.perPage;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown localStorage parse error";
    derror("state", "failed to restore hh settings", msg);
  }
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

  state.hhUseDemo = nextState.hhUseDemo !== false;
  state.hhApiKey = typeof nextState.hhApiKey === "string" ? nextState.hhApiKey : "";
  state.hhSearchQuery = typeof nextState.hhSearchQuery === "string" && nextState.hhSearchQuery.trim()
    ? nextState.hhSearchQuery.trim()
    : "NAME:Python";

  const hhArea = Number(nextState.hhArea);
  state.hhArea = Number.isInteger(hhArea) && hhArea > 0 ? hhArea : 1;

  const hhPerPage = Number(nextState.hhPerPage);
  state.hhPerPage = Number.isInteger(hhPerPage) && hhPerPage >= 1 ? Math.min(hhPerPage, 100) : 20;

  state.hhResumes = sanitizeHhResumes(nextState.hhResumes);
  state.hhSelectedResumeId = typeof nextState.hhSelectedResumeId === "string" ? nextState.hhSelectedResumeId : "";
  state.hhNotice = typeof nextState.hhNotice === "string" ? nextState.hhNotice : "";

  state.compensationQuery = typeof nextState.compensationQuery === "string" ? nextState.compensationQuery : "";
  state.compensationModel = typeof nextState.compensationModel === "string" && nextState.compensationModel
    ? nextState.compensationModel
    : DEFAULT_MODEL;
  state.compensationResult = sanitizeCompensationResult(nextState.compensationResult);
  state.version = 1;
};

export function saveState() {
  saveHhSettings();
  dlog("state", "runtime updated", "items", state.items.length, "analysis", state.analysisItems.length);
}

export function loadState() {
  hydrateState(createInitialState());
  restoreHhSettings();
}

export function loadVacancyIntoState(record) {
  hydrateState({
    query: typeof record?.query === "string" ? record.query : "",
    model: typeof record?.model === "string" ? record.model : DEFAULT_MODEL,
    items: Array.isArray(record?.items) ? record.items : [],
    resumeText: "",
    analysisItems: [],
    activeVacancyId: Number(record?.id),
    activeAnalysisId: null,
    hhUseDemo: state.hhUseDemo,
    hhApiKey: state.hhApiKey,
    hhSearchQuery: state.hhSearchQuery,
    hhArea: state.hhArea,
    hhPerPage: state.hhPerPage,
    hhResumes: state.hhResumes,
    hhSelectedResumeId: state.hhSelectedResumeId,
    hhNotice: state.hhNotice,
    compensationQuery: state.compensationQuery,
    compensationModel: state.compensationModel,
    compensationResult: state.compensationResult
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
    activeAnalysisId: Number(record?.id),
    hhUseDemo: state.hhUseDemo,
    hhApiKey: state.hhApiKey,
    hhSearchQuery: state.hhSearchQuery,
    hhArea: state.hhArea,
    hhPerPage: state.hhPerPage,
    hhResumes: state.hhResumes,
    hhSelectedResumeId: state.hhSelectedResumeId,
    hhNotice: state.hhNotice,
    compensationQuery: state.compensationQuery,
    compensationModel: state.compensationModel,
    compensationResult: state.compensationResult
  });
}

export function resetState() {
  const defaults = createInitialState();
  hydrateState({
    ...defaults,
    hhUseDemo: state.hhUseDemo,
    hhApiKey: state.hhApiKey,
    hhSearchQuery: state.hhSearchQuery,
    hhArea: state.hhArea,
    hhPerPage: state.hhPerPage
  });
}

export function setHhResumes(items) {
  state.hhResumes = sanitizeHhResumes(items);
  const exists = state.hhResumes.some((item) => item.id === state.hhSelectedResumeId);
  if (!exists) {
    state.hhSelectedResumeId = state.hhResumes[0]?.id || "";
  }
}

export function setHhSelectedResumeId(value) {
  const normalized = typeof value === "string" ? value : "";
  const exists = state.hhResumes.some((item) => item.id === normalized);
  state.hhSelectedResumeId = exists ? normalized : "";
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

export function getBestVersionResult() {
  return bestVersionResult;
}

export function setBestVersionResult(result) {
  if (!result || typeof result !== "object") {
    bestVersionResult = null;
    return;
  }

  const bestVacancyId = Number(result.bestVacancyId);
  bestVersionResult = {
    query: typeof result.query === "string" ? result.query : "",
    bestVacancyId: Number.isInteger(bestVacancyId) ? bestVacancyId : null,
    bestVacancyText: typeof result.bestVacancyText === "string" ? result.bestVacancyText : "",
    whyNotOthers: typeof result.whyNotOthers === "string" ? result.whyNotOthers : ""
  };
}

export function resetRuntimeState() {
  currentScreen = "input";
  lastMarkdown = "";
  lastAnalysisMarkdown = "";
  selectedHistoryEntry = null;
  bestVersionResult = null;
}
