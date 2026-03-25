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
import {
  generateCompensationInsights as generateCompensationInsightsRequest,
  generateRequirements as generateRequirementsRequest
} from "./ollama-api.js";
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
  setHhSelectedResumeId,
  setHistoryFilter,
  setHistoryRecords,
  setLastAnalysisMarkdown,
  setSelectedHistoryEntry,
  state
} from "./state.js";
import {
  buildAnalysisCsv,
  buildAnalysisCsvFromRecord,
  buildAnalysisMarkdown,
  buildRequirementsCsv,
  buildRequirementsCsvFromRecord,
  downloadCsv,
  downloadMarkdown,
  hideError,
  parseCompensationInsightsResponse,
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
  setCompensationAnalyzing,
  setGenerating
} from "./ui-renderer.js";
import {
  applySelectedHhResume,
  compareResumeWithRequirements,
  fetchHhResumes,
  onAnalysisGridClick,
  onResumeFile
} from "./resume-analysis.js";

// ─── SECTION: DOM References ───
const dom = {
  screenInput: document.getElementById("screenInput"),
  screenCompensation: document.getElementById("screenCompensation"),
  screenCards: document.getElementById("screenCards"),
  screenPreview: document.getElementById("screenPreview"),
  screenAnalysis: document.getElementById("screenAnalysis"),
  screenArchive: document.getElementById("screenArchive"),
  screenBestVersion: document.getElementById("screenBestVersion"),
  globalNavNewButton: document.getElementById("globalNavNewButton"),
  globalNavCompensationButton: document.getElementById("globalNavCompensationButton"),
  globalNavArchiveButton: document.getElementById("globalNavArchiveButton"),
  globalCurrentVacancy: document.getElementById("globalCurrentVacancy"),
  openArchiveButton: document.getElementById("openArchiveButton"),
  queryInput: document.getElementById("queryInput"),
  modelSelect: document.getElementById("modelSelect"),
  generateButton: document.getElementById("generateButton"),
  inputHint: document.getElementById("inputHint"),
  compensationQueryInput: document.getElementById("compensationQueryInput"),
  compensationModelSelect: document.getElementById("compensationModelSelect"),
  compensationAnalyzeButton: document.getElementById("compensationAnalyzeButton"),
  compensationStatus: document.getElementById("compensationStatus"),
  compensationSalaryRange: document.getElementById("compensationSalaryRange"),
  compensationCompanyConditions: document.getElementById("compensationCompanyConditions"),
  compensationHiringRecommendations: document.getElementById("compensationHiringRecommendations"),
  cardsMetaCount: document.getElementById("cardsMetaCount"),
  cardsGrid: document.getElementById("cardsGrid"),
  backToInputButton: document.getElementById("backToInputButton"),
  createDocumentButton: document.getElementById("createDocumentButton"),
  markdownPreview: document.getElementById("markdownPreview"),
  downloadButton: document.getElementById("downloadButton"),
  downloadCsvButton: document.getElementById("downloadCsvButton"),
  nextToAnalysisButton: document.getElementById("nextToAnalysisButton"),
  startOverButton: document.getElementById("startOverButton"),
  resumeInput: document.getElementById("resumeInput"),
  resumeFile: document.getElementById("resumeFile"),
  resumeDropzone: document.getElementById("resumeDropzone"),
  pdfPreviewWrap: document.getElementById("pdfPreviewWrap"),
  pdfPreview: document.getElementById("pdfPreview"),
  compareButton: document.getElementById("compareButton"),
  hhUseDemoCheckbox: document.getElementById("hhUseDemoCheckbox"),
  hhApiKeyInput: document.getElementById("hhApiKeyInput"),
  hhSearchQueryInput: document.getElementById("hhSearchQueryInput"),
  hhAreaInput: document.getElementById("hhAreaInput"),
  hhPerPageInput: document.getElementById("hhPerPageInput"),
  hhFetchButton: document.getElementById("hhFetchButton"),
  hhResumeSelect: document.getElementById("hhResumeSelect"),
  hhApplyResumeButton: document.getElementById("hhApplyResumeButton"),
  hhNotice: document.getElementById("hhNotice"),
  analysisMetaCount: document.getElementById("analysisMetaCount"),
  analysisGrid: document.getElementById("analysisGrid"),
  backToPreviewButton: document.getElementById("backToPreviewButton"),
  downloadAnalysisButton: document.getElementById("downloadAnalysisButton"),
  downloadAnalysisCsvButton: document.getElementById("downloadAnalysisCsvButton"),
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
  bestVersionLoadingOverlay: document.getElementById("bestVersionLoadingOverlay"),
  globalError: document.getElementById("globalError"),
  globalErrorMessage: document.getElementById("globalErrorMessage"),
  retryButton: document.getElementById("retryButton")
};

// ─── SECTION: Best Version Loading UI ───
const BEST_VERSION_BUTTON_DEFAULT_TEXT = "Найти лучшую версию";
let bestVersionLoadingStart = 0;

function setBestVersionButtonLoading(button, isLoading) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent || BEST_VERSION_BUTTON_DEFAULT_TEXT;
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? "Поиск..." : (button.dataset.originalText || BEST_VERSION_BUTTON_DEFAULT_TEXT);
}

function showBestVersionLoading() {
  bestVersionLoadingStart = Date.now();
  dlog("Showing loading indicator");

  if (!dom.bestVersionLoadingOverlay) {
    return;
  }

  dom.bestVersionLoadingOverlay.classList.remove("hidden");
  dom.bestVersionLoadingOverlay.classList.add("flex");
}

function hideBestVersionLoading() {
  const elapsed = Math.max(0, Date.now() - bestVersionLoadingStart);
  dlog(`Hiding loading indicator after ${elapsed} ms`);

  if (!dom.bestVersionLoadingOverlay) {
    return;
  }

  dom.bestVersionLoadingOverlay.classList.add("hidden");
  dom.bestVersionLoadingOverlay.classList.remove("flex");
}

// ─── SECTION: Persistence & Archive Helpers ───
async function persistVacancySnapshot(markdown, csv) {
  const payload = {
    query: state.query,
    model: state.model,
    items: state.items,
    markdown,
    csv
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
  dlog("archive", "refresh", "filter", getHistoryFilter());
  const records = await listHistoryRecords(getHistoryFilter());
  setHistoryRecords(records);
  dlog("archive", "refresh complete", "records", records.length);

  if (getCurrentScreen() === "archive") {
    renderArchiveScreen();
  }
}

async function openHistoryRecord(kind, id) {
  const numericId = Number(id);
  dlog("archive", "open request", kind, numericId);

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
  dlog("archive", "delete request", kind, id);
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

async function analyzeCompensationInsights() {
  hideError();

  const query = dom.compensationQueryInput.value.trim();
  const model = dom.compensationModelSelect.value || DEFAULT_MODEL;

  if (!query) {
    showError("Введите роль или специализацию для оценки зарплаты и условий.");
    return;
  }

  state.compensationQuery = query;
  state.compensationModel = model;
  saveState();
  dlog("compensation", "starting", "query", query, "model", model);

  setCompensationAnalyzing(true);

  try {
    const outputText = await generateCompensationInsightsRequest({ query, model });
    const parsed = parseCompensationInsightsResponse(outputText);
    state.compensationResult = {
      salaryRange: parsed.salaryRange,
      companyConditions: parsed.companyConditions,
      hiringRecommendations: parsed.hiringRecommendations
    };
    saveState();

    renderCurrentScreen();
    dlog("compensation", "success", "salary chars", state.compensationResult.salaryRange.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Неизвестная ошибка.";
    derror("compensation", "error", msg);
    showError(`Не удалось получить оценку зарплаты и условий. ${msg}`, () => {
      analyzeCompensationInsights();
    });
  } finally {
    setCompensationAnalyzing(false);
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
    dlog("card change", "skip invalid index", target.dataset.index);
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
      dlog("card change", "index", index, "action", action, "validation", "empty text");
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
  dlog("navigation", "back to input");
  renderCurrentScreen();
}

function onOpenCompensation() {
  hideError();
  setCurrentScreen("compensation");
  dlog("navigation", "open compensation screen");
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
    const markdown = getLastMarkdown();
    const csv = buildRequirementsCsv(state);
    await persistVacancySnapshot(markdown, csv);
    saveState();
    await refreshHistory();
    dlog("document", "persisted", "vacancy id", state.activeVacancyId);
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
  dlog("navigation", "back to preview");
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

function onDownloadCsv() {
  if (!state.items.length) {
    showError("Нечего скачивать. Сначала сформируйте требования вакансии.");
    return;
  }

  const csv = buildRequirementsCsv(state);
  const filename = `${sanitizeFilename(state.query || "vakansiya")}-requirements.csv`;
  dlog("download", "requirements-csv", filename, "chars", csv.length);
  downloadCsv(filename, csv);
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

function onDownloadAnalysisCsv() {
  if (!state.analysisItems.length) {
    showError("Нечего скачивать. Сначала выполните сравнение резюме.");
    return;
  }

  const csv = buildAnalysisCsv(state);
  const filename = `${sanitizeFilename(state.query || "vakansiya")}-analysis.csv`;
  dlog("download", "analysis-csv", filename, "chars", csv.length);
  downloadCsv(filename, csv);
}

async function downloadHistoryCsv(kind, id) {
  dlog("archive", "download history csv request", kind, id);

  if (kind === "vacancy") {
    const record = await getVacancyRecordById(id);
    if (!record) {
      throw new Error("Вакансия не найдена для CSV экспорта.");
    }

    const csv = typeof record.csv === "string" && record.csv.trim()
      ? record.csv
      : buildRequirementsCsvFromRecord(record);
    const filename = `${sanitizeFilename(record.query || "vakansiya")}-requirements-archive.csv`;
    dlog("archive", "download csv", kind, id, "chars", csv.length);
    downloadCsv(filename, csv);
    return;
  }

  if (kind === "analysis") {
    const record = await getAnalysisRecordById(id);
    if (!record) {
      throw new Error("Анализ не найден для CSV экспорта.");
    }

    let linkedItems = [];
    const linkedVacancyId = Number(record.vacancyId);
    if (Number.isInteger(linkedVacancyId)) {
      const linkedVacancy = await getVacancyRecordById(linkedVacancyId);
      if (linkedVacancy && Array.isArray(linkedVacancy.items)) {
        linkedItems = linkedVacancy.items;
      }
    }

    const csv = typeof record.csv === "string" && record.csv.trim()
      ? record.csv
      : buildAnalysisCsvFromRecord(record, linkedItems);
    const filename = `${sanitizeFilename(record.query || "analiz")}-analysis-archive.csv`;
    dlog("archive", "download csv", kind, id, "chars", csv.length);
    downloadCsv(filename, csv);
    return;
  }

  throw new Error("Неизвестный тип записи архива для CSV экспорта.");
}

async function onOpenArchive(source = "workflow") {
  hideError();
  dlog("archive", "open request", "source", source);

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
  dlog("navigation", "back from archive", "target", target);
  renderCurrentScreen();
}

function onBackToArchiveFromBest() {
  hideError();
  setCurrentScreen("archive");
  dlog("navigation", "back to archive from best-version");
  renderCurrentScreen();
}

async function onOpenBestVacancy() {
  hideError();
  const result = getBestVersionResult();
  if (!result || !Number.isInteger(result.bestVacancyId)) {
    showError("Не удалось определить лучшую вакансию для открытия.");
    return;
  }

  dlog("best-version", "open best vacancy", result.bestVacancyId);
  try {
    await openHistoryRecord("vacancy", result.bestVacancyId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось открыть выбранную лучшую вакансию.";
    derror("best-version", "open vacancy", "error", msg);
    showError(`Не удалось открыть выбранную лучшую вакансию. ${msg}`);
  }
}

async function onFindBestVersion(vacancyId, triggerButton = null) {
  hideError();
  setBestVersionResult(null);

  const numericVacancyId = Number(vacancyId);
  const historyVacancy = getHistoryRecords().find((record) => record.kind === "vacancy" && record.id === numericVacancyId);
  const queryTitle = historyVacancy && typeof historyVacancy.query === "string" && historyVacancy.query.trim()
    ? historyVacancy.query.trim()
    : "—";

  dlog(`Starting best version search for query: ${queryTitle}`);
  setBestVersionButtonLoading(triggerButton, true);
  showBestVersionLoading();

  try {
    const result = await selectBestVacancyVersion({
      vacancyId: numericVacancyId,
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
      onFindBestVersion(numericVacancyId, triggerButton);
    });
  } finally {
    setBestVersionButtonLoading(triggerButton, false);
    hideBestVersionLoading();
  }
}

async function onHistoryFilterChange() {
  const nextFilter = dom.historyFilterSelect.value;
  dlog("archive", "filter change", nextFilter);
  setHistoryFilter(nextFilter);
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
  dlog("archive", "grid action", action, "kind", kind, "id", id);

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

    if (action === "download-history-csv") {
      await downloadHistoryCsv(kind, id);
      return;
    }

    if (action === "find-best-version") {
      await onFindBestVersion(id, target);
      return;
    }

    if (action === "delete-history") {
      const ok = window.confirm("Удалить выбранную запись из архива? Это действие нельзя отменить.");
      if (!ok) {
        dlog("archive", "delete cancelled", kind, id);
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
    dlog("archive", "clear cancelled");
    return;
  }

  hideError();
  dlog("archive", "clear start");

  try {
    await clearAllHistory();
    setHistoryRecords([]);
    setSelectedHistoryEntry(null);
    setBestVersionResult(null);
    renderArchiveScreen();
    dlog("archive", "clear complete");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось очистить архив.";
    derror("archive", "clear", "error", msg);
    showError(`Не удалось очистить архив. ${msg}`);
  }
}

// ─── SECTION: Event Wiring ───
function setupEventListeners() {
  dom.globalNavNewButton.addEventListener("click", () => {
    dlog("event", "globalNavNewButton click");
    startOver("navigation");
  });

  dom.globalNavCompensationButton.addEventListener("click", () => {
    dlog("event", "globalNavCompensationButton click");
    onOpenCompensation();
  });

  dom.globalNavArchiveButton.addEventListener("click", () => {
    dlog("event", "globalNavArchiveButton click");
    onOpenArchive("navigation");
  });

  dom.openArchiveButton.addEventListener("click", () => {
    dlog("event", "openArchiveButton click");
    onOpenArchive();
  });

  dom.generateButton.addEventListener("click", () => {
    dlog("event", "generateButton click");
    generateRequirements();
  });

  dom.compensationAnalyzeButton.addEventListener("click", () => {
    dlog("event", "compensationAnalyzeButton click");
    analyzeCompensationInsights();
  });

  dom.cardsGrid.addEventListener("click", onCardsGridClick);
  dom.backToInputButton.addEventListener("click", onBackToInput);
  dom.createDocumentButton.addEventListener("click", () => {
    dlog("event", "createDocumentButton click");
    onCreateDocument();
  });
  dom.downloadButton.addEventListener("click", onDownload);
  dom.downloadCsvButton.addEventListener("click", onDownloadCsv);
  dom.nextToAnalysisButton.addEventListener("click", onNextToAnalysis);
  dom.startOverButton.addEventListener("click", () => {
    dlog("event", "startOverButton click");
    startOver();
  });

  dom.compareButton.addEventListener("click", async () => {
    dlog("event", "compareButton click");
    state.resumeText = dom.resumeInput.value;
    saveState();
    await compareResumeWithRequirements();
    await refreshHistory();
  });

  dom.hhUseDemoCheckbox.addEventListener("change", () => {
    state.hhUseDemo = dom.hhUseDemoCheckbox.checked;
    state.hhNotice = state.hhUseDemo
      ? "Демо-режим hh.ru включён."
      : "Режим API hh.ru включён. Укажите API-ключ и нажмите загрузку.";
    saveState();
    dlog("hh", "mode changed", state.hhUseDemo ? "demo" : "api");
    renderCurrentScreen();
  });

  dom.hhApiKeyInput.addEventListener("input", () => {
    state.hhApiKey = dom.hhApiKeyInput.value;
    saveState();
    dlog("hh", "api key updated", "length", state.hhApiKey.length);
  });

  dom.hhSearchQueryInput.addEventListener("input", () => {
    state.hhSearchQuery = dom.hhSearchQueryInput.value;
    saveState();
    dlog("hh", "search query updated", state.hhSearchQuery);
  });

  dom.hhAreaInput.addEventListener("input", () => {
    const area = Number(dom.hhAreaInput.value);
    state.hhArea = Number.isInteger(area) && area > 0 ? area : 1;
    saveState();
    dlog("hh", "area updated", state.hhArea);
  });

  dom.hhPerPageInput.addEventListener("input", () => {
    const perPage = Number(dom.hhPerPageInput.value);
    state.hhPerPage = Number.isInteger(perPage) && perPage >= 1 ? Math.min(perPage, 100) : 20;
    saveState();
    dlog("hh", "per-page updated", state.hhPerPage);
  });

  dom.hhFetchButton.addEventListener("click", async () => {
    dlog("event", "hhFetchButton click");
    await fetchHhResumes(dom);
  });

  dom.hhResumeSelect.addEventListener("change", () => {
    setHhSelectedResumeId(dom.hhResumeSelect.value);
    saveState();
    dlog("hh", "selected resume", state.hhSelectedResumeId || "none");
    renderCurrentScreen();
  });

  dom.hhApplyResumeButton.addEventListener("click", () => {
    dlog("event", "hhApplyResumeButton click");
    applySelectedHhResume(dom);
  });

  dom.analysisGrid.addEventListener("click", (event) => {
    onAnalysisGridClick(event, dom);
  });
  dom.backToPreviewButton.addEventListener("click", onBackToPreview);
  dom.downloadAnalysisButton.addEventListener("click", onDownloadAnalysis);
  dom.downloadAnalysisCsvButton.addEventListener("click", onDownloadAnalysisCsv);
  dom.analysisStartOverButton.addEventListener("click", () => {
    dlog("event", "analysisStartOverButton click");
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
    dlog("input", "query updated", "chars", state.query.length);
  });

  dom.modelSelect.addEventListener("change", () => {
    state.model = dom.modelSelect.value || DEFAULT_MODEL;
    saveState();
    dlog("input", "model updated", state.model);
  });

  dom.compensationQueryInput.addEventListener("input", () => {
    state.compensationQuery = dom.compensationQueryInput.value;
    saveState();
    dlog("input", "compensation query updated", "chars", state.compensationQuery.length);
  });

  dom.compensationModelSelect.addEventListener("change", () => {
    state.compensationModel = dom.compensationModelSelect.value || DEFAULT_MODEL;
    saveState();
    dlog("input", "compensation model updated", state.compensationModel);
  });

  dom.resumeInput.addEventListener("input", () => {
    state.resumeText = dom.resumeInput.value;
    saveState();
    dlog("input", "resume updated", "chars", state.resumeText.length);
  });

  dom.resumeFile.addEventListener("change", async () => {
    const file = dom.resumeFile.files?.[0] || null;
    dlog("event", "resumeFile change", file ? file.name : "no file");
    await onResumeFile(file, dom);
    dom.resumeFile.value = "";
  });

  dom.resumeDropzone.addEventListener("click", () => {
    dlog("event", "resumeDropzone click");
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
    dlog("event", "resumeDropzone drop", file ? file.name : "no file");
    await onResumeFile(file, dom);
  });

  dlog("init", "event listeners wired");
}

// ─── SECTION: Bootstrap ───
document.addEventListener("DOMContentLoaded", async () => {
  dlog("init", "DOMContentLoaded");
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
  dlog("init", "initial screen", getCurrentScreen());
  renderCurrentScreen();
});
