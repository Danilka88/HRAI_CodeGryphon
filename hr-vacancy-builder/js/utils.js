// ─── SECTION: Imports ───
import { DEFAULT_MODEL, dlog } from "./config.js";

// ─── SECTION: Internal UI Context ───
let dom = null;
let lastErrorRetryAction = null;

// ─── SECTION: UI Error Helpers ───
export function setUtilsDom(nextDom) {
  dom = nextDom;
}

export function hideError() {
  if (!dom) {
    return;
  }

  dom.globalError.classList.add("hidden");
  dom.globalErrorMessage.textContent = "";
  lastErrorRetryAction = null;
  dom.retryButton.classList.add("hidden");
}

export function showError(message, retryAction = null) {
  if (!dom) {
    return;
  }

  dom.globalErrorMessage.textContent = message;
  dom.globalError.classList.remove("hidden");
  lastErrorRetryAction = typeof retryAction === "function" ? retryAction : null;
  dom.retryButton.classList.toggle("hidden", !lastErrorRetryAction);
}

export function runRetryAction() {
  if (typeof lastErrorRetryAction === "function") {
    hideError();
    dlog("retry", "triggered");
    lastErrorRetryAction();
  }
}

// ─── SECTION: Ollama Response Parsing ───
function splitDelimitedUnique(raw, logTag) {
  if (typeof raw !== "string") {
    throw new Error("Ответ модели не является текстом.");
  }

  const normalized = raw.replace(/\r/g, "").trim();
  dlog(logTag, "raw length", normalized.length);
  if (!normalized) {
    throw new Error("Модель вернула пустой ответ.");
  }

  const parts = normalized
    .split(";;;")
    .map((part) => part.trim())
    .map((part) => part.replace(/^[-*\d.)\s]+/g, "").replace(/^"|"$/g, "").trim())
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const item of parts) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  dlog(logTag, "parsed items", unique.length);
  if (!unique.length) {
    throw new Error("Ответ модели не содержит корректных пунктов, разделенных через ;;;.");
  }

  return unique;
}

export function parseOllamaResponse(raw) {
  return splitDelimitedUnique(raw, "parse").map((text, idx) => ({
    id: `req-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    status: "approved",
    isEditing: false
  }));
}

export function parseAnalysisResponse(raw) {
  return splitDelimitedUnique(raw, "analysis parse").map((line, idx) => {
    const match = line.match(/^(?:сильная\s+сторона|слабая\s+сторона|strength|weakness)\s*:\s*(.+)$/i);
    const isWeak = /^(?:слабая\s+сторона|weakness)\s*:/i.test(line);
    const text = (match
      ? match[1]
      : line.replace(/^(?:сильная\s+сторона|слабая\s+сторона|strength|weakness)\s*:\s*/i, "")
    ).trim();

    if (!text) {
      throw new Error("Текст пункта анализа пуст.");
    }

    return {
      id: `analysis-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      type: isWeak ? "weakness" : "strength",
      text,
      isEditing: false
    };
  });
}

// ─── SECTION: Markdown Helpers ───
export function escapeMarkdown(text) {
  return text.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, "\\$&");
}

export function buildMarkdown(state) {
  const approvedItems = state.items.filter((item) => item.status !== "rejected" && item.text.trim());
  const titleQuery = state.query.trim() || "Вакансия без названия";
  const lines = [
    `# Требования к вакансии: ${titleQuery}`,
    "",
    `Сформировано моделью **${state.model || DEFAULT_MODEL}** через локальную Ollama.`,
    "",
    "## Требования к кандидату",
    ""
  ];

  if (!approvedItems.length) {
    lines.push("- _Нет утвержденных требований._");
  } else {
    approvedItems.forEach((item) => {
      lines.push(`- ${escapeMarkdown(item.text)}`);
    });
  }

  return lines.join("\n");
}

export function buildAnalysisMarkdown(state) {
  const titleQuery = state.query.trim() || "Вакансия без названия";
  const approvedItems = state.items.filter((item) => item.status !== "rejected" && item.text.trim());
  const strengths = state.analysisItems.filter((item) => item.type === "strength" && item.text.trim());
  const weaknesses = state.analysisItems.filter((item) => item.type === "weakness" && item.text.trim());
  const lines = [
    `# Анализ резюме: ${titleQuery}`,
    "",
    `Сформировано моделью **${state.model || DEFAULT_MODEL}** через локальную Ollama.`,
    "",
    "## Сводка требований",
    ""
  ];

  if (!approvedItems.length) {
    lines.push("- _Нет утвержденных требований._");
  } else {
    approvedItems.forEach((item) => lines.push(`- ${escapeMarkdown(item.text)}`));
  }

  lines.push("", "## Сильные стороны", "");
  if (!strengths.length) {
    lines.push("- _Сильные стороны не обнаружены._");
  } else {
    strengths.forEach((item) => lines.push(`- ${escapeMarkdown(item.text)}`));
  }

  lines.push("", "## Слабые стороны", "");
  if (!weaknesses.length) {
    lines.push("- _Слабые стороны не обнаружены._");
  } else {
    weaknesses.forEach((item) => lines.push(`- ${escapeMarkdown(item.text)}`));
  }

  return lines.join("\n");
}

// ─── SECTION: CSV Helpers ───
function safeString(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function protectCsvFormula(value) {
  const normalized = safeString(value);
  const trimmed = normalized.trimStart();
  if (!trimmed) {
    return normalized;
  }

  if (/^[=+\-@]/.test(trimmed)) {
    return `'${normalized}`;
  }

  return normalized;
}

function escapeCsvCell(value) {
  const protectedValue = protectCsvFormula(value);
  const escaped = protectedValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsv(rows) {
  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function normalizeVacancyItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      status: item.status === "rejected" ? "rejected" : "approved",
      text: item.text.trim()
    }))
    .filter((item) => item.text);
}

function normalizeAnalysisItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      type: item.type === "weakness" ? "weakness" : "strength",
      text: item.text.trim()
    }))
    .filter((item) => item.text);
}

function normalizeTimestamp(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

export function buildRequirementsCsvFromRecord(record) {
  const items = normalizeVacancyItems(record?.items);
  const query = safeString(record?.query).trim();
  const model = safeString(record?.model).trim() || DEFAULT_MODEL;
  const generatedAt = normalizeTimestamp(record?.timestamp);

  const rows = [[
    "record_type",
    "query",
    "model",
    "generated_at",
    "item_index",
    "item_status",
    "item_text"
  ]];

  if (!items.length) {
    rows.push(["vacancy", query, model, generatedAt, "", "", ""]);
    return toCsv(rows);
  }

  items.forEach((item, index) => {
    rows.push([
      "vacancy",
      query,
      model,
      generatedAt,
      String(index + 1),
      item.status,
      item.text
    ]);
  });

  return toCsv(rows);
}

export function buildRequirementsCsv(state) {
  return buildRequirementsCsvFromRecord({
    query: state?.query,
    model: state?.model,
    timestamp: Date.now(),
    items: state?.items
  });
}

export function buildAnalysisCsvFromRecord(record, linkedVacancyItems = []) {
  const analysisItems = normalizeAnalysisItems(record?.analysisItems);
  const query = safeString(record?.query).trim();
  const model = safeString(record?.model).trim() || DEFAULT_MODEL;
  const generatedAt = normalizeTimestamp(record?.timestamp);
  const resumeText = safeString(record?.resumeText);
  const vacancyId = Number(record?.vacancyId);
  const safeVacancyId = Number.isInteger(vacancyId) ? String(vacancyId) : "";

  const requirementsText = normalizeVacancyItems(linkedVacancyItems)
    .filter((item) => item.status !== "rejected")
    .map((item) => item.text)
    .join(" | ");

  const rows = [[
    "record_type",
    "query",
    "model",
    "generated_at",
    "vacancy_id",
    "requirements_summary",
    "resume_text",
    "item_index",
    "item_type",
    "item_text"
  ]];

  if (!analysisItems.length) {
    rows.push([
      "analysis",
      query,
      model,
      generatedAt,
      safeVacancyId,
      requirementsText,
      resumeText,
      "",
      "",
      ""
    ]);
    return toCsv(rows);
  }

  analysisItems.forEach((item, index) => {
    rows.push([
      "analysis",
      query,
      model,
      generatedAt,
      safeVacancyId,
      requirementsText,
      resumeText,
      String(index + 1),
      item.type,
      item.text
    ]);
  });

  return toCsv(rows);
}

export function buildAnalysisCsv(state) {
  return buildAnalysisCsvFromRecord({
    query: state?.query,
    model: state?.model,
    timestamp: Date.now(),
    vacancyId: state?.activeVacancyId,
    resumeText: state?.resumeText,
    analysisItems: state?.analysisItems
  }, state?.items);
}

// ─── SECTION: Download & Filename Helpers ───
export function sanitizeFilename(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "trebovaniya-k-vakansii"
  );
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  // Keep the object URL alive briefly so slower browsers can start the download reliably.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadMarkdown(filename, content) {
  downloadTextFile(filename, content, "text/markdown;charset=utf-8");
}

export function downloadCsv(filename, content) {
  downloadTextFile(filename, content, "text/csv;charset=utf-8");
}
