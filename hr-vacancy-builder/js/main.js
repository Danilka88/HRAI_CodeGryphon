// ─── SECTION: Imports ───
import { selectBestVacancyVersion } from "./best-version.js";
import { DEFAULT_MODEL, derror, dlog } from "./config.js";
import {
  clearAllHistory,
  createVacancyRecord,
  deleteHistoryRecord,
  getAnalysisRecordById,
  getVacancyRecordById,
  initDatabase,
  listHistoryRecords,
  updateVacancyRecord
} from "./indexeddb.js";
import { generateRequirements as generateRequirementsRequest } from "./ollama-api.js";
import {
  getBestVersionResult,
  getCurrentScreen,
  getHistoryFilter,
  getHistoryRecords,
  getLastMarkdown,
  loadAnalysisIntoState,
  loadState,
  loadVacancyIntoState,
  resetRuntimeState,
  resetState,
  saveState,
  setBestVersionResult,
  setCurrentScreen,
  setHistoryFilter,
  setHistoryRecords,
  setLastAnalysisMarkdown,
  setSelectedHistoryEntry,
  state
} from "./state.js";
import {
  buildAnalysisMarkdown,
  downloadMarkdown,
  hideError,
  parseOllamaResponse,
  runRetryAction,
  sanitizeFilename,
  setUtilsDom,
  showError
} from "./utils.js";
import {
  initUIRenderer,
  renderArchiveScreen,
  renderCardsScreen,
  renderCurrentScreen,
  resetPdfPreview,
  setGenerating
} from "./ui-renderer.js";
import {
  compareResumeWithRequirements,
  onAnalysisGridClick,
  onResumeFile
} from "./resume-analysis.js";

// ─── SECTION: DOM References ───
const dom = {
  screenInput: document.getElementById("screenInput"),
  screenCards: document.getElementById("screenCards"),
  screenPreview: document.getElementById("screenPreview"),
  screenAnalysis: document.getElementById("screenAnalysis"),
  screenArchive: document.getElementById("screenArchive"),
  screenBestVersion: document.getElementById("screenBestVersion"),
  globalNavNewButton: document.getElementById("globalNavNewButton"),
  globalNavArchiveButton: document.getElementById("globalNavArchiveButton"),
  globalCurrentVacancy: document.getElementById("globalCurrentVacancy"),
  openArchiveButton: document.getElementById("openArchiveButton"),
  queryInput: document.getElementById("queryInput"),
  modelSelect: document.getElementById("modelSelect"),
  generateButton: document.getElementById("generateButton"),
  inputHint: document.getElementById("inputHint"),
  cardsMetaCount: document.getElementById("cardsMetaCount"),
  cardsGrid: document.getElementById("cardsGrid"),
  backToInputButton: document.getElementById("backToInputButton"),
  createDocumentButton: document.getElementById("createDocumentButton"),
  markdownPreview: document.getElementById("markdownPreview"),
  downloadButton: document.getElementById("downloadButton"),
  nextToAnalysisButton: document.getElementById("nextToAnalysisButton"),
  startOverButton: document.getElementById("startOverButton"),
  resumeInput: document.getElementById("resumeInput"),
  resumeFile: document.getElementById("resumeFile"),
  resumeDropzone: document.getElementById("resumeDropzone"),
  pdfPreviewWrap: document.getElementById("pdfPreviewWrap"),
  pdfPreview: document.getElementById("pdfPreview"),
  compareButton: document.getElementById("compareButton"),
  analysisMetaCount: document.getElementById("analysisMetaCount"),
  analysisGrid: document.getElementById("analysisGrid"),
  backToPreviewButton: document.getElementById("backToPreviewButton"),
  downloadAnalysisButton: document.getElementById("downloadAnalysisButton"),
  analysisStartOverButton: document.getElementById("analysisStartOverButton"),
  historyFilterSelect: document.getElementById("historyFilterSelect"),
  historyMetaCount: document.getElementById("historyMetaCount"),
  historyGrid: document.getElementById("historyGrid"),
  historyEmpty: document.getElementById("historyEmpty"),
  backFromArchiveButton: document.getElementById("backFromArchiveButton"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  bestVersionQueryTitle: document.getElementById("bestVersionQueryTitle"),
  bestVersionBestBlock: document.getElementById("bestVersionBestBlock"),
  bestVersionWhyBlock: document.getElementById("bestVersionWhyBlock"),
  openBestVacancyButton: document.getElementById("openBestVacancyButton"),
  backToArchiveFromBestButton: document.getElementById("backToArchiveFromBestButton"),
  globalError: document.getElementById("globalError"),
  globalErrorMessage: document.getElementById("globalErrorMessage"),
  retryButton: document.getElementById("retryButton")
};

// ─── SECTION: Persistence & Archive Helpers ───
async function persistVacancySnapshot(markdown) {
  const payload = {
    query: state.query,
    model: state.model,
    items: state.items,
    markdown
  };

  if (Number.isInteger(state.activeVacancyId)) {
    await updateVacancyRecord(state.activeVacancyId, payload);
    dlog("indexeddb", "vacancy updated", state.activeVacancyId);
    return state.activeVacancyId;
  }

  const createdId = await createVacancyRecord(payload);
  state.activeVacancyId = createdId;
  dlog("indexeddb", "vacancy created", createdId);
  return createdId;
}

async function refreshHistory() {
  const records = await listHistoryRecords(getHistoryFilter());
  setHistoryRecords(records);
  if (getCurrentScreen() === "archive") {
    renderArchiveScreen();
  }
}

async function openHistoryRecord(kind, id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    showError("Некорректный идентификатор записи архива.");
    return;
  }

  hideError();
  if (kind === "vacancy") {
    const vacancy = await getVacancyRecordById(numericId);
    if (!vacancy) {
      throw new Error("Выбранная вакансия не найдена в архиве.");
    }

    loadVacancyIntoState(vacancy);
    setCurrentScreen("cards");
    dlog("archive", "opened vacancy", numericId);
    renderCurrentScreen();
    return;
  }

  if (kind === "analysis") {
    const analysis = await getAnalysisRecordById(numericId);
    if (!analysis) {
      throw new Error("Выбранный анализ не найден в архиве.");
    }

    let linkedItems = [];
    const linkedVacancyId = Number(analysis.vacancyId);
    if (Number.isInteger(linkedVacancyId)) {
      const vacancy = await getVacancyRecordById(linkedVacancyId);
      if (vacancy && Array.isArray(vacancy.items)) {
        linkedItems = vacancy.items;
      }
    }

    loadAnalysisIntoState(analysis, linkedItems);
    setLastAnalysisMarkdown(typeof analysis.markdown === "string" ? analysis.markdown : "");
    setCurrentScreen("analysis");
    dlog("archive", "opened analysis", numericId, "linked vacancy", state.activeVacancyId);
    renderCurrentScreen();
    return;
  }

  throw new Error("Неизвестный тип записи архива.");
}

async function removeHistoryRecord(kind, id) {
  await deleteHistoryRecord(kind, id);
  const selected = state.activeVacancyId === Number(id) || state.activeAnalysisId === Number(id);
  if (selected && kind === "vacancy") {
    state.activeVacancyId = null;
  }
  if (selected && kind === "analysis") {
    state.activeAnalysisId = null;
  }
  dlog("archive", "deleted", kind, id);
}

// ─── SECTION: Core Actions ───
async function generateRequirements() {
  hideError();

  const query = dom.queryInput.value.trim();
  const model = dom.modelSelect.value || DEFAULT_MODEL;

  if (!query) {
    showError("Введите запрос вакансии перед генерацией требований.");
    return;
  }

  state.query = query;
  state.model = model;
  state.activeVacancyId = null;
  state.activeAnalysisId = null;
  saveState();
  dlog("generate", "starting", "query", query, "model", model);

  setGenerating(true);

  try {
    const outputText = await generateRequirementsRequest({ query, model });
    const items = parseOllamaResponse(outputText);
    state.items = items;
    state.analysisItems = [];
    state.resumeText = "";
    saveState();
    dlog("ollama response", "success", "items", items.length);

    setCurrentScreen("cards");
    renderCurrentScreen();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Неизвестная ошибка.";
    derror("ollama response", "error", msg);
    showError(`Не удалось подключиться к локальной Ollama. ${msg}`, () => {
      generateRequirements();
    });
  } finally {
    setGenerating(false);
  }
}

function startOver(source = "workflow") {
  hideError();
  resetState();
  saveState();
  resetRuntimeState();
  resetPdfPreview();

  if (source === "navigation") {
    dlog("navigation", "Started new vacancy");
  } else {
    dlog("init", "start over");
  }

  renderCurrentScreen();
}

// ─── SECTION: Card Interactions ───
function onCardsGridClick(event) {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const index = Number(target.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.items.length) {
    return;
  }

  const action = target.dataset.action;
  const item = state.items[index];

  if (action === "approve") {
    item.status = "approved";
    saveState();
    dlog("card change", "index", index, "action", action, "new", { status: item.status, text: item.text });
    renderCardsScreen();
    return;
  }

  if (action === "reject") {
    item.status = "rejected";
    item.isEditing = false;
    saveState();
    dlog("card change", "index", index, "action", action, "new", { status: item.status, text: item.text });
    renderCardsScreen();
    return;
  }

  if (action === "edit") {
    if (!item.isEditing) {
      state.items.forEach((card) => {
        card.isEditing = false;
      });
      item.isEditing = true;
      dlog("card change", "index", index, "action", action, "new", { status: item.status, text: item.text });
      renderCardsScreen();

      const editable = dom.cardsGrid.querySelector(`[data-role="card-text"][data-index="${index}"]`);
      if (editable) {
        editable.focus();
        document.execCommand("selectAll", false, null);
        document.getSelection()?.collapseToEnd();
      }
      return;
    }

    const editable = dom.cardsGrid.querySelector(`[data-role="card-text"][data-index="${index}"]`);
    const updatedText = editable ? editable.textContent.trim() : "";
    if (!updatedText) {
      showError("Текст требования не может быть пустым.");
      return;
    }

    item.text = updatedText;
    item.status = "approved";
    item.isEditing = false;
    saveState();
    dlog("card change", "index", index, "action", action, "new", { status: item.status, text: item.text });
    renderCardsScreen();
  }
}

// ─── SECTION: Navigation & Downloads ───
function onBackToInput() {
  hideError();
  setCurrentScreen("input");
  renderCurrentScreen();
}

async function onCreateDocument() {
  hideError();
  const approvedCount = state.items.filter((item) => item.status !== "rejected" && item.text.trim()).length;
  if (!approvedCount) {
    showError("Утвердите хотя бы одно требование, чтобы создать документ.");
    return;
  }

  dlog("document", "approved count", approvedCount);
  setCurrentScreen("preview");
  renderCurrentScreen();

  try {
    await persistVacancySnapshot(getLastMarkdown());
    saveState();
    await refreshHistory();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось сохранить вакансию.";
    derror("indexeddb", "save vacancy", "error", msg);
    showError(`Документ создан, но сохранить его в архив не удалось. ${msg}`);
  }
}

function onNextToAnalysis() {
  hideError();
  setCurrentScreen("analysis");
  dlog("analysis", "open screen", "cards", state.analysisItems.length);
  renderCurrentScreen();
}

function onBackToPreview() {
  hideError();
  setCurrentScreen("preview");
  renderCurrentScreen();
}

function onDownload() {
  const markdown = getLastMarkdown();
  if (!markdown.trim()) {
    showError("Нечего скачивать. Сначала сформируйте документ.");
    return;
  }

  const filename = `${sanitizeFilename(state.query || "vakansiya")}-requirements.md`;
  dlog("download", "requirements", filename, "chars", markdown.length);
  downloadMarkdown(filename, markdown);
}

function onDownloadAnalysis() {
  if (!state.analysisItems.length) {
    showError("Нечего скачивать. Сначала выполните сравнение резюме.");
    return;
  }

  const markdown = buildAnalysisMarkdown(state);
  setLastAnalysisMarkdown(markdown);
  const filename = `${sanitizeFilename(state.query || "vakansiya")}-analysis.md`;
  dlog("download", "analysis", filename, "chars", markdown.length);
  downloadMarkdown(filename, markdown);
}

async function onOpenArchive(source = "workflow") {
  hideError();
  try {
    await refreshHistory();
    setCurrentScreen("archive");

    if (source === "navigation") {
      dlog("navigation", "Navigated to History");
    }

    renderCurrentScreen();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось открыть архив.";
    derror("archive", "open", "error", msg);
    showError(`Не удалось открыть архив. ${msg}`);
  }
}

function onBackFromArchive() {
  hideError();
  const target = state.items.length ? "cards" : "input";
  setCurrentScreen(target);
  renderCurrentScreen();
}

function onBackToArchiveFromBest() {
  hideError();
  setCurrentScreen("archive");
  renderCurrentScreen();
}

async function onOpenBestVacancy() {
  hideError();
  const result = getBestVersionResult();
  if (!result || !Number.isInteger(result.bestVacancyId)) {
    showError("Не удалось определить лучшую вакансию для открытия.");
    return;
  }

  try {
    await openHistoryRecord("vacancy", result.bestVacancyId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось открыть выбранную лучшую вакансию.";
    derror("best-version", "open vacancy", "error", msg);
    showError(`Не удалось открыть выбранную лучшую вакансию. ${msg}`);
  }
}

async function onFindBestVersion(vacancyId) {
  hideError();
  setBestVersionResult(null);
  dlog("best-version", "start", "vacancy", vacancyId);

  try {
    const result = await selectBestVacancyVersion({
      vacancyId,
      model: state.model || DEFAULT_MODEL
    });

    setBestVersionResult(result);
    setCurrentScreen("best-version");
    dlog("best-version", "ready", "best vacancy", result.bestVacancyId, "query", result.query);
    renderCurrentScreen();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось выбрать лучшую версию вакансии.";
    derror("best-version", "error", msg);
    showError(`Не удалось выбрать лучшую версию вакансии. ${msg}`, () => {
      onFindBestVersion(vacancyId);
    });
  }
}

async function onHistoryFilterChange() {
  setHistoryFilter(dom.historyFilterSelect.value);
  setSelectedHistoryEntry(null);
  try {
    await refreshHistory();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось применить фильтр архива.";
    derror("archive", "filter", "error", msg);
    showError(`Не удалось применить фильтр архива. ${msg}`);
  }
}

async function onHistoryGridClick(event) {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const kind = target.dataset.kind;
  const id = Number(target.dataset.id);
  if (!Number.isInteger(id)) {
    showError("Некорректный идентификатор записи архива.");
    return;
  }

  try {
    if (action === "select-history") {
      setSelectedHistoryEntry({ kind, id });
      renderArchiveScreen();
      return;
    }

    if (action === "open-history" || action === "edit-history") {
      await openHistoryRecord(kind, id);
      return;
    }

    if (action === "find-best-version") {
      await onFindBestVersion(id);
      return;
    }

    if (action === "delete-history") {
      const ok = window.confirm("Удалить выбранную запись из архива? Это действие нельзя отменить.");
      if (!ok) {
        return;
      }

      await removeHistoryRecord(kind, id);
      setSelectedHistoryEntry(null);
      await refreshHistory();
      return;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ошибка работы с архивом.";
    derror("archive", action || "unknown", "error", msg);
    showError(`Ошибка работы с архивом. ${msg}`);
  }
}

async function onClearHistory() {
  const ok = window.confirm("Очистить весь архив (вакансии и анализы)? Действие необратимо.");
  if (!ok) {
    return;
  }

  hideError();
  try {
    await clearAllHistory();
    setHistoryRecords([]);
    setSelectedHistoryEntry(null);
    setBestVersionResult(null);
    renderArchiveScreen();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось очистить архив.";
    derror("archive", "clear", "error", msg);
    showError(`Не удалось очистить архив. ${msg}`);
  }
}

// ─── SECTION: Event Wiring ───
function setupEventListeners() {
  dom.globalNavNewButton.addEventListener("click", () => {
    startOver("navigation");
  });

  dom.globalNavArchiveButton.addEventListener("click", () => {
    onOpenArchive("navigation");
  });

  dom.openArchiveButton.addEventListener("click", () => {
    onOpenArchive();
  });

  dom.generateButton.addEventListener("click", () => {
    generateRequirements();
  });

  dom.cardsGrid.addEventListener("click", onCardsGridClick);
  dom.backToInputButton.addEventListener("click", onBackToInput);
  dom.createDocumentButton.addEventListener("click", () => {
    onCreateDocument();
  });
  dom.downloadButton.addEventListener("click", onDownload);
  dom.nextToAnalysisButton.addEventListener("click", onNextToAnalysis);
  dom.startOverButton.addEventListener("click", () => {
    startOver();
  });

  dom.compareButton.addEventListener("click", async () => {
    state.resumeText = dom.resumeInput.value;
    saveState();
    await compareResumeWithRequirements();
    await refreshHistory();
  });

  dom.analysisGrid.addEventListener("click", (event) => {
    onAnalysisGridClick(event, dom);
  });
  dom.backToPreviewButton.addEventListener("click", onBackToPreview);
  dom.downloadAnalysisButton.addEventListener("click", onDownloadAnalysis);
  dom.analysisStartOverButton.addEventListener("click", () => {
    startOver();
  });

  dom.historyFilterSelect.addEventListener("change", () => {
    onHistoryFilterChange();
  });
  dom.historyGrid.addEventListener("click", (event) => {
    onHistoryGridClick(event);
  });
  dom.backFromArchiveButton.addEventListener("click", onBackFromArchive);
  dom.clearHistoryButton.addEventListener("click", () => {
    onClearHistory();
  });

  dom.openBestVacancyButton.addEventListener("click", () => {
    onOpenBestVacancy();
  });

  dom.backToArchiveFromBestButton.addEventListener("click", () => {
    onBackToArchiveFromBest();
  });

  dom.retryButton.addEventListener("click", runRetryAction);

  dom.queryInput.addEventListener("input", () => {
    state.query = dom.queryInput.value;
    saveState();
  });

  dom.modelSelect.addEventListener("change", () => {
    state.model = dom.modelSelect.value || DEFAULT_MODEL;
    saveState();
  });

  dom.resumeInput.addEventListener("input", () => {
    state.resumeText = dom.resumeInput.value;
    saveState();
  });

  dom.resumeFile.addEventListener("change", async () => {
    const file = dom.resumeFile.files?.[0] || null;
    await onResumeFile(file, dom);
    dom.resumeFile.value = "";
  });

  dom.resumeDropzone.addEventListener("click", () => {
    dom.resumeFile.click();
  });

  dom.resumeDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.resumeDropzone.classList.add("border-blue-400", "bg-blue-50");
  });

  dom.resumeDropzone.addEventListener("dragleave", () => {
    dom.resumeDropzone.classList.remove("border-blue-400", "bg-blue-50");
  });

  dom.resumeDropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dom.resumeDropzone.classList.remove("border-blue-400", "bg-blue-50");
    const file = event.dataTransfer?.files?.[0] || null;
    await onResumeFile(file, dom);
  });
}

// ─── SECTION: Bootstrap ───
document.addEventListener("DOMContentLoaded", async () => {
  setUtilsDom(dom);
  initUIRenderer(dom);

  loadState();
  dlog(
    "init",
    "loaded runtime state",
    "items",
    state.items.length,
    "analysis",
    state.analysisItems.length,
    "resume chars",
    (state.resumeText || "").length
  );

  try {
    await initDatabase();
    await refreshHistory();
    dlog("init", "indexeddb ready", "history", getHistoryRecords().length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось инициализировать IndexedDB.";
    derror("indexeddb", "init", "error", msg);
    showError(`Архив недоступен. ${msg}`);
  }

  setupEventListeners();

  setCurrentScreen(state.items.length ? "cards" : "input");
  renderCurrentScreen();
});
