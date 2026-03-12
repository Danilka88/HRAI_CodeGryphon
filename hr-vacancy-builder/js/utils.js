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
    throw new Error("Model response is not text.");
  }

  const normalized = raw.replace(/\r/g, "").trim();
  dlog(logTag, "raw length", normalized.length);
  if (!normalized) {
    throw new Error("Model returned an empty response.");
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
    throw new Error("Model response does not contain valid requirements separated by ;;;.");
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
    const match = line.match(/^(strength|weakness)\s*:\s*(.+)$/i);
    const type = match ? match[1].toLowerCase() : /^weak/i.test(line) ? "weakness" : "strength";
    const text = (match ? match[2] : line.replace(/^(strength|weakness)\s*:\s*/i, "")).trim();

    if (!text) {
      throw new Error("Analysis item text is empty.");
    }

    return {
      id: `analysis-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      type: type === "weakness" ? "weakness" : "strength",
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
  const titleQuery = state.query.trim() || "Untitled Vacancy";
  const lines = [
    `# Vacancy Requirements: ${titleQuery}`,
    "",
    `Generated with model **${state.model || DEFAULT_MODEL}** via local Ollama.`,
    "",
    "## Candidate Requirements",
    ""
  ];

  if (!approvedItems.length) {
    lines.push("- _No approved requirements available._");
  } else {
    approvedItems.forEach((item) => {
      lines.push(`- ${escapeMarkdown(item.text)}`);
    });
  }

  return lines.join("\n");
}

export function buildAnalysisMarkdown(state) {
  const titleQuery = state.query.trim() || "Untitled Vacancy";
  const approvedItems = state.items.filter((item) => item.status !== "rejected" && item.text.trim());
  const strengths = state.analysisItems.filter((item) => item.type === "strength" && item.text.trim());
  const weaknesses = state.analysisItems.filter((item) => item.type === "weakness" && item.text.trim());
  const lines = [
    `# Resume Analysis: ${titleQuery}`,
    "",
    `Generated with model **${state.model || DEFAULT_MODEL}** via local Ollama.`,
    "",
    "## Requirements Summary",
    ""
  ];

  if (!approvedItems.length) {
    lines.push("- _No approved requirements available._");
  } else {
    approvedItems.forEach((item) => lines.push(`- ${escapeMarkdown(item.text)}`));
  }

  lines.push("", "## Strengths", "");
  if (!strengths.length) {
    lines.push("- _No strengths detected._");
  } else {
    strengths.forEach((item) => lines.push(`- ${escapeMarkdown(item.text)}`));
  }

  lines.push("", "## Weaknesses", "");
  if (!weaknesses.length) {
    lines.push("- _No weaknesses detected._");
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
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "vacancy-requirements"
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
