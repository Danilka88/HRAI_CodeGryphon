// ─── SECTION: Imports ───
import {
  DB_NAME,
  DB_VERSION,
  STORE_ANALYSES,
  STORE_VACANCIES,
  derror,
  dlog,
  dwarn
} from "./config.js";

// ─── SECTION: Internal DB Cache ───
let dbPromise = null;

// ─── SECTION: Common Helpers ───
function asError(error, fallbackMessage) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallbackMessage);
}

function openRequestToPromise(request, label) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      dlog("indexeddb", label, "success");
      resolve(request.result);
    };

    request.onerror = () => {
      const error = asError(request.error, `Ошибка IndexedDB при ${label}.`);
      derror("indexeddb", label, "error", error.message);
      reject(error);
    };
  });
}

function normalizeQueryText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeVacancyItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.text === "string")
    .map((item, idx) => ({
      id: typeof item.id === "string" ? item.id : `vacancy-item-${Date.now()}-${idx}`,
      text: item.text.trim(),
      status: item.status === "rejected" ? "rejected" : "approved"
    }))
    .filter((item) => item.text);
}

function sanitizeAnalysisItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.text === "string")
    .map((item, idx) => ({
      id: typeof item.id === "string" ? item.id : `analysis-item-${Date.now()}-${idx}`,
      text: item.text.trim(),
      type: item.type === "weakness" ? "weakness" : "strength"
    }))
    .filter((item) => item.text);
}

function sanitizeCsv(value) {
  return typeof value === "string" ? value : "";
}

// ─── SECTION: DB Init ───
export function initDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    dlog("indexeddb", "init", "opening", DB_NAME, "version", DB_VERSION);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      dlog("indexeddb", "upgrade", "from", request.transaction?.db?.version || 0, "to", DB_VERSION);

      if (!db.objectStoreNames.contains(STORE_VACANCIES)) {
        const vacanciesStore = db.createObjectStore(STORE_VACANCIES, {
          keyPath: "id",
          autoIncrement: true
        });
        vacanciesStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_ANALYSES)) {
        const analysesStore = db.createObjectStore(STORE_ANALYSES, {
          keyPath: "id",
          autoIncrement: true
        });
        analysesStore.createIndex("timestamp", "timestamp", { unique: false });
        analysesStore.createIndex("vacancyId", "vacancyId", { unique: false });
      }
    };

    request.onblocked = () => {
      dwarn("indexeddb", "init", "blocked", "Закройте другие вкладки приложения для обновления базы.");
    };

    request.onerror = () => {
      const error = asError(request.error, "Не удалось открыть IndexedDB.");
      derror("indexeddb", "init", "error", error.message);
      reject(error);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        dwarn("indexeddb", "versionchange", "closing old connection");
        db.close();
      };

      dlog("indexeddb", "init", "ready", DB_NAME);
      resolve(db);
    };
  });

  return dbPromise;
}

// ─── SECTION: Vacancy CRUD ───
export async function createVacancyRecord(payload) {
  const db = await initDatabase();
  const record = {
    timestamp: Date.now(),
    query: typeof payload?.query === "string" ? payload.query.trim() : "",
    model: typeof payload?.model === "string" ? payload.model.trim() : "",
    items: sanitizeVacancyItems(payload?.items),
    markdown: typeof payload?.markdown === "string" ? payload.markdown : "",
    csv: sanitizeCsv(payload?.csv)
  };

  dlog("indexeddb", "save vacancy", "start", record.query || "без названия", "items", record.items.length);
  const tx = db.transaction(STORE_VACANCIES, "readwrite");
  const store = tx.objectStore(STORE_VACANCIES);
  const request = store.add(record);
  const id = await openRequestToPromise(request, "save vacancy");
  return Number(id);
}

export async function updateVacancyRecord(id, payload) {
  const db = await initDatabase();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error("Некорректный ID вакансии для обновления.");
  }

  const current = await getVacancyRecordById(numericId);
  if (!current) {
    throw new Error("Вакансия для обновления не найдена.");
  }

  const record = {
    id: numericId,
    timestamp: Date.now(),
    query: typeof payload?.query === "string" ? payload.query.trim() : current.query,
    model: typeof payload?.model === "string" ? payload.model.trim() : current.model,
    items: sanitizeVacancyItems(payload?.items ?? current.items),
    markdown: typeof payload?.markdown === "string" ? payload.markdown : current.markdown,
    csv: typeof payload?.csv === "string" ? payload.csv : sanitizeCsv(current.csv)
  };

  dlog("indexeddb", "update vacancy", "start", numericId, record.query || "без названия");
  const tx = db.transaction(STORE_VACANCIES, "readwrite");
  const store = tx.objectStore(STORE_VACANCIES);
  const request = store.put(record);
  await openRequestToPromise(request, "update vacancy");
  return numericId;
}

export async function getVacancyRecordById(id) {
  const db = await initDatabase();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return null;
  }

  dlog("indexeddb", "get vacancy", numericId);
  const tx = db.transaction(STORE_VACANCIES, "readonly");
  const store = tx.objectStore(STORE_VACANCIES);
  const request = store.get(numericId);
  const result = await openRequestToPromise(request, "get vacancy");
  return result || null;
}

export async function deleteVacancyRecord(id) {
  const db = await initDatabase();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error("Некорректный ID вакансии для удаления.");
  }

  dlog("indexeddb", "delete vacancy", numericId);
  const tx = db.transaction(STORE_VACANCIES, "readwrite");
  const store = tx.objectStore(STORE_VACANCIES);
  const request = store.delete(numericId);
  await openRequestToPromise(request, "delete vacancy");
}

export async function listVacancyRecords() {
  const db = await initDatabase();
  dlog("indexeddb", "list vacancies", "start");
  const tx = db.transaction(STORE_VACANCIES, "readonly");
  const store = tx.objectStore(STORE_VACANCIES);
  const request = store.getAll();
  const items = await openRequestToPromise(request, "list vacancies");
  return Array.isArray(items) ? items : [];
}

export async function listRecentVacanciesByQuery(query, limit = 3) {
  const normalizedQuery = normalizeQueryText(query);
  const normalizedLimit = Number(limit);
  const safeLimit = Number.isInteger(normalizedLimit) && normalizedLimit > 0 ? normalizedLimit : 3;

  if (!normalizedQuery) {
    return [];
  }

  const records = await listVacancyRecords();
  const similarRecords = records
    .filter((record) => normalizeQueryText(record?.query) === normalizedQuery)
    .sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))
    .slice(0, safeLimit);

  dlog("indexeddb", "list similar vacancies", "query", normalizedQuery, "total", similarRecords.length);
  return similarRecords;
}

// ─── SECTION: Analysis CRUD ───
export async function createAnalysisRecord(payload) {
  const db = await initDatabase();
  const vacancyId = Number(payload?.vacancyId);
  const record = {
    timestamp: Date.now(),
    vacancyId: Number.isInteger(vacancyId) ? vacancyId : null,
    query: typeof payload?.query === "string" ? payload.query.trim() : "",
    model: typeof payload?.model === "string" ? payload.model.trim() : "",
    resumeText: typeof payload?.resumeText === "string" ? payload.resumeText : "",
    analysisItems: sanitizeAnalysisItems(payload?.analysisItems),
    markdown: typeof payload?.markdown === "string" ? payload.markdown : "",
    csv: sanitizeCsv(payload?.csv)
  };

  dlog("indexeddb", "save analysis", "start", record.query || "без названия", "items", record.analysisItems.length);
  const tx = db.transaction(STORE_ANALYSES, "readwrite");
  const store = tx.objectStore(STORE_ANALYSES);
  const request = store.add(record);
  const id = await openRequestToPromise(request, "save analysis");
  return Number(id);
}

export async function updateAnalysisRecord(id, payload) {
  const db = await initDatabase();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error("Некорректный ID анализа для обновления.");
  }

  const current = await getAnalysisRecordById(numericId);
  if (!current) {
    throw new Error("Анализ для обновления не найден.");
  }

  const payloadVacancyId = Number(payload?.vacancyId);
  const record = {
    id: numericId,
    timestamp: Date.now(),
    vacancyId: Number.isInteger(payloadVacancyId)
      ? payloadVacancyId
      : (Number.isInteger(Number(current.vacancyId)) ? Number(current.vacancyId) : null),
    query: typeof payload?.query === "string" ? payload.query.trim() : current.query,
    model: typeof payload?.model === "string" ? payload.model.trim() : current.model,
    resumeText: typeof payload?.resumeText === "string" ? payload.resumeText : current.resumeText,
    analysisItems: sanitizeAnalysisItems(payload?.analysisItems ?? current.analysisItems),
    markdown: typeof payload?.markdown === "string" ? payload.markdown : current.markdown,
    csv: typeof payload?.csv === "string" ? payload.csv : sanitizeCsv(current.csv)
  };

  dlog("indexeddb", "update analysis", "start", numericId, record.query || "без названия");
  const tx = db.transaction(STORE_ANALYSES, "readwrite");
  const store = tx.objectStore(STORE_ANALYSES);
  const request = store.put(record);
  await openRequestToPromise(request, "update analysis");
  return numericId;
}

export async function getAnalysisRecordById(id) {
  const db = await initDatabase();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return null;
  }

  dlog("indexeddb", "get analysis", numericId);
  const tx = db.transaction(STORE_ANALYSES, "readonly");
  const store = tx.objectStore(STORE_ANALYSES);
  const request = store.get(numericId);
  const result = await openRequestToPromise(request, "get analysis");
  return result || null;
}

export async function deleteAnalysisRecord(id) {
  const db = await initDatabase();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error("Некорректный ID анализа для удаления.");
  }

  dlog("indexeddb", "delete analysis", numericId);
  const tx = db.transaction(STORE_ANALYSES, "readwrite");
  const store = tx.objectStore(STORE_ANALYSES);
  const request = store.delete(numericId);
  await openRequestToPromise(request, "delete analysis");
}

export async function listAnalysisRecords() {
  const db = await initDatabase();
  dlog("indexeddb", "list analyses", "start");
  const tx = db.transaction(STORE_ANALYSES, "readonly");
  const store = tx.objectStore(STORE_ANALYSES);
  const request = store.getAll();
  const items = await openRequestToPromise(request, "list analyses");
  return Array.isArray(items) ? items : [];
}

// ─── SECTION: Combined History API ───
export async function listHistoryRecords(filter = "all") {
  const normalizedFilter = ["all", "vacancies", "analyses"].includes(filter) ? filter : "all";
  dlog("indexeddb", "load history", "filter", normalizedFilter);

  const vacancies = normalizedFilter === "analyses" ? [] : await listVacancyRecords();
  const analyses = normalizedFilter === "vacancies" ? [] : await listAnalysisRecords();

  const vacancyRows = vacancies.map((item) => ({
    id: Number(item.id),
    kind: "vacancy",
    timestamp: Number(item.timestamp) || 0,
    query: typeof item.query === "string" ? item.query : "",
    count: Array.isArray(item.items) ? item.items.length : 0,
    model: typeof item.model === "string" ? item.model : ""
  }));

  const analysisRows = analyses.map((item) => ({
    id: Number(item.id),
    kind: "analysis",
    timestamp: Number(item.timestamp) || 0,
    query: typeof item.query === "string" ? item.query : "",
    count: Array.isArray(item.analysisItems) ? item.analysisItems.length : 0,
    model: typeof item.model === "string" ? item.model : "",
    vacancyId: Number.isInteger(Number(item.vacancyId)) ? Number(item.vacancyId) : null
  }));

  return [...vacancyRows, ...analysisRows].sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteHistoryRecord(kind, id) {
  if (kind === "vacancy") {
    await deleteVacancyRecord(id);
    return;
  }

  if (kind === "analysis") {
    await deleteAnalysisRecord(id);
    return;
  }

  throw new Error("Неизвестный тип записи для удаления.");
}

export async function clearAllHistory() {
  const db = await initDatabase();
  dlog("indexeddb", "clear history", "start");

  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VACANCIES, STORE_ANALYSES], "readwrite");
    tx.objectStore(STORE_VACANCIES).clear();
    tx.objectStore(STORE_ANALYSES).clear();

    tx.oncomplete = () => {
      dlog("indexeddb", "clear history", "success");
      resolve();
    };

    tx.onabort = () => {
      const error = asError(tx.error, "Не удалось очистить архив IndexedDB.");
      derror("indexeddb", "clear history", "abort", error.message);
      reject(error);
    };

    tx.onerror = () => {
      const error = asError(tx.error, "Не удалось очистить архив IndexedDB.");
      derror("indexeddb", "clear history", "error", error.message);
      reject(error);
    };
  });
}
