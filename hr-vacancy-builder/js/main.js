// ─── SECTION: Imports ───
import { DEFAULT_MODEL, derror, dlog } from "./config.js";
import { generateRequirements as generateRequirementsRequest } from "./ollama-api.js";
import {
  getLastMarkdown,
  resetRuntimeState,
  resetState,
  saveState,
  loadState,
  setCurrentScreen,
  setLastAnalysisMarkdown,
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
  renderAnalysisScreen,
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
  globalError: document.getElementById("globalError"),
  globalErrorMessage: document.getElementById("globalErrorMessage"),
  retryButton: document.getElementById("retryButton")
};

// ─── SECTION: Core Actions ───
async function generateRequirements() {
  hideError();

  const query = dom.queryInput.value.trim();
  const model = dom.modelSelect.value || DEFAULT_MODEL;

  if (!query) {
    showError("Please enter a job request before generating requirements.");
    return;
  }

  state.query = query;
  state.model = model;
  saveState(showError);
  dlog("generate", "starting", "query", query, "model", model);

  setGenerating(true);

  try {
    const outputText = await generateRequirementsRequest({ query, model });
    const items = parseOllamaResponse(outputText);
    state.items = items;
    state.analysisItems = [];
    saveState(showError);
    dlog("ollama response", "success", "items", items.length);

    setCurrentScreen("cards");
    renderCurrentScreen();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    derror("ollama response", "error", msg);
    showError(`Failed to connect to local Ollama. ${msg}`, () => {
      generateRequirements();
    });
  } finally {
    setGenerating(false);
  }
}

function startOver() {
  hideError();
  resetState();
  saveState(showError);
  resetRuntimeState();
  resetPdfPreview();
  dlog("init", "start over");
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
    saveState(showError);
    dlog("card change", "index", index, "action", action, "new", { status: item.status, text: item.text });
    renderCardsScreen();
    return;
  }

  if (action === "reject") {
    item.status = "rejected";
    item.isEditing = false;
    saveState(showError);
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
      showError("Requirement text cannot be empty.");
      return;
    }

    item.text = updatedText;
    item.status = "approved";
    item.isEditing = false;
    saveState(showError);
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

function onCreateDocument() {
  hideError();
  const approvedCount = state.items.filter((item) => item.status !== "rejected" && item.text.trim()).length;
  if (!approvedCount) {
    showError("Approve at least one requirement to create a document.");
    return;
  }

  dlog("document", "approved count", approvedCount);
  setCurrentScreen("preview");
  renderCurrentScreen();
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
    showError("Nothing to download. Please generate the document first.");
    return;
  }

  const filename = `${sanitizeFilename(state.query || "vacancy")}-requirements.md`;
  dlog("download", "requirements", filename, "chars", markdown.length);
  downloadMarkdown(filename, markdown);
}

function onDownloadAnalysis() {
  if (!state.analysisItems.length) {
    showError("Nothing to download. Please run resume comparison first.");
    return;
  }

  const markdown = buildAnalysisMarkdown(state);
  setLastAnalysisMarkdown(markdown);
  const filename = `${sanitizeFilename(state.query || "vacancy")}-analysis.md`;
  dlog("download", "analysis", filename, "chars", markdown.length);
  downloadMarkdown(filename, markdown);
}

// ─── SECTION: Event Wiring ───
function setupEventListeners() {
  dom.generateButton.addEventListener("click", () => {
    generateRequirements();
  });

  dom.cardsGrid.addEventListener("click", onCardsGridClick);
  dom.backToInputButton.addEventListener("click", onBackToInput);
  dom.createDocumentButton.addEventListener("click", onCreateDocument);
  dom.downloadButton.addEventListener("click", onDownload);
  dom.nextToAnalysisButton.addEventListener("click", onNextToAnalysis);
  dom.startOverButton.addEventListener("click", startOver);

  dom.compareButton.addEventListener("click", () => {
    state.resumeText = dom.resumeInput.value;
    saveState(showError);
    compareResumeWithRequirements();
  });

  dom.analysisGrid.addEventListener("click", (event) => {
    onAnalysisGridClick(event, dom);
  });
  dom.backToPreviewButton.addEventListener("click", onBackToPreview);
  dom.downloadAnalysisButton.addEventListener("click", onDownloadAnalysis);
  dom.analysisStartOverButton.addEventListener("click", startOver);
  dom.retryButton.addEventListener("click", runRetryAction);

  dom.queryInput.addEventListener("input", () => {
    state.query = dom.queryInput.value;
    saveState(showError);
  });

  dom.modelSelect.addEventListener("change", () => {
    state.model = dom.modelSelect.value || DEFAULT_MODEL;
    saveState(showError);
  });

  dom.resumeInput.addEventListener("input", () => {
    state.resumeText = dom.resumeInput.value;
    saveState(showError);
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
document.addEventListener("DOMContentLoaded", () => {
  setUtilsDom(dom);
  initUIRenderer(dom);

  loadState(showError);
  dlog(
    "init",
    "loaded state",
    "items",
    state.items.length,
    "analysis",
    state.analysisItems.length,
    "resume chars",
    (state.resumeText || "").length
  );

  setupEventListeners();

  setCurrentScreen(state.items.length ? "cards" : "input");
  renderCurrentScreen();
});
