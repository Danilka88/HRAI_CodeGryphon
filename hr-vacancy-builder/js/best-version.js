// ─── SECTION: Imports ───
import { DEFAULT_MODEL, dlog } from "./config.js";
import { getVacancyRecordById, listRecentVacanciesByQuery } from "./indexeddb.js";
import { generateBestVersionChoice } from "./ollama-api.js";

// ─── SECTION: Parsing Helpers ───
function extractField(parts, key) {
  const prefix = `${key}:`;
  const matched = parts.find((part) => part.toUpperCase().startsWith(prefix));
  if (!matched) {
    return "";
  }

  return matched.slice(prefix.length).trim();
}

export function parseBestVersionResponse(raw, candidates) {
  if (typeof raw !== "string") {
    throw new Error("Ответ модели не является текстом.");
  }

  const parts = raw
    .replace(/\r/g, "")
    .split(";;;")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    throw new Error("Модель вернула пустой ответ при выборе лучшей версии.");
  }

  const normalizedParts = parts.map((part) => part.replace(/^\s+|\s+$/g, ""));
  const bestIdText = extractField(normalizedParts, "BEST_ID");
  const bestVacancyText = extractField(normalizedParts, "BEST_TEXT");
  const whyNotOthers = extractField(normalizedParts, "WHY_NOT_OTHERS");

  const bestVacancyId = Number(bestIdText);
  const candidateIds = new Set(candidates.map((item) => Number(item?.id)).filter((id) => Number.isInteger(id)));

  if (!Number.isInteger(bestVacancyId) || !candidateIds.has(bestVacancyId)) {
    throw new Error("Модель вернула некорректный BEST_ID для выбранных версий вакансии.");
  }

  if (!bestVacancyText) {
    throw new Error("Модель не вернула BEST_TEXT для лучшей версии вакансии.");
  }

  if (!whyNotOthers) {
    throw new Error("Модель не вернула WHY_NOT_OTHERS для сравнения версий вакансии.");
  }

  return {
    bestVacancyId,
    bestVacancyText,
    whyNotOthers
  };
}

// ─── SECTION: Selection Orchestration ───
function uniqVacanciesById(records) {
  const map = new Map();
  records.forEach((record) => {
    const id = Number(record?.id);
    if (!Number.isInteger(id) || map.has(id)) {
      return;
    }
    map.set(id, record);
  });
  return Array.from(map.values());
}

export async function selectBestVacancyVersion({ vacancyId, model }) {
  const numericVacancyId = Number(vacancyId);
  if (!Number.isInteger(numericVacancyId)) {
    throw new Error("Некорректный ID вакансии для поиска лучшей версии.");
  }

  const sourceVacancy = await getVacancyRecordById(numericVacancyId);
  if (!sourceVacancy) {
    throw new Error("Исходная вакансия не найдена в архиве.");
  }

  const query = typeof sourceVacancy.query === "string" ? sourceVacancy.query.trim() : "";
  if (!query) {
    throw new Error("У выбранной вакансии отсутствует query для поиска похожих версий.");
  }

  const recent = await listRecentVacanciesByQuery(query, 3);
  const candidates = uniqVacanciesById([sourceVacancy, ...recent])
    .sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))
    .slice(0, 3);

  dlog("best-version", "candidates", candidates.length, "query", query);
  if (candidates.length < 2) {
    throw new Error("Для этой вакансии недостаточно похожих версий в архиве (нужно минимум 2). Сгенерируйте еще одну версию с тем же query.");
  }

  const selectedModel = model || sourceVacancy.model || DEFAULT_MODEL;
  const raw = await generateBestVersionChoice({
    query,
    vacancies: candidates,
    model: selectedModel
  });

  const parsed = parseBestVersionResponse(raw, candidates);
  return {
    query,
    ...parsed
  };
}
