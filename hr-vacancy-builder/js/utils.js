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

export function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
