// ─── SECTION: Imports ───
import { DEFAULT_MODEL, derror, dlog } from "./config.js";
import { generateResumeAnalysis } from "./ollama-api.js";
import { saveState, state } from "./state.js";
import {
  parseAnalysisResponse,
  showError,
  hideError
} from "./utils.js";
import {
  renderAnalysisScreen,
  resetPdfPreview,
  setComparing
} from "./ui-renderer.js";

// ─── SECTION: File Readers ───
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Cannot read file."));
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Cannot read file."));
    reader.readAsDataURL(file);
  });
}

// ─── SECTION: Resume Upload Logic ───
export async function onResumeFile(file, dom) {
  if (!file) {
    return;
  }

  hideError();
  dlog("upload", "start", file.name, file.type || "unknown", file.size);

  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isText = file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md");

  try {
    if (isPdf) {
      const dataUrl = await readFileAsDataURL(file);
      dom.pdfPreview.src = dataUrl;
      dom.pdfPreviewWrap.classList.remove("hidden");
      dlog("upload", "pdf preview ready", file.name);
      showError("PDF preview loaded. Please paste resume text manually for analysis.");
      return;
    }

    resetPdfPreview();
    if (!isText) {
      throw new Error("Unsupported file type. Please use .txt, .md, or .pdf.");
    }

    const text = (await readFileAsText(file)).replace(/\r/g, "").trim();
    if (!text) {
      throw new Error("Uploaded file is empty.");
    }

    state.resumeText = text;
    saveState(showError);
    dom.resumeInput.value = text;
    dlog("upload", "text loaded", "chars", text.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cannot process uploaded file.";
    derror("upload", "error", msg);
    showError(msg);
  }
}

// ─── SECTION: Analysis Generation ───
export async function compareResumeWithRequirements() {
  hideError();

  const resumeText = state.resumeText.trim();
  const model = state.model || DEFAULT_MODEL;
  const requirements = state.items
    .filter((item) => item.status !== "rejected" && item.text.trim())
    .map((item) => item.text);

  if (!requirements.length) {
    showError("No approved requirements found. Please create a document first.");
    return;
  }

  if (!resumeText) {
    showError("Please paste resume text (or upload .txt/.md) before comparison.");
    return;
  }

  state.model = model;
  saveState(showError);
  dlog("analysis", "starting", "resume chars", resumeText.length, "requirements", requirements.length, "model", model);

  setComparing(true);
  try {
    const outputText = await generateResumeAnalysis({
      requirements,
      resumeText,
      model
    });
    const parsed = parseAnalysisResponse(outputText);
    state.analysisItems = parsed;
    saveState(showError);
    dlog("analysis", "parsed items", parsed.length);
    renderAnalysisScreen();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    derror("analysis", "error", msg);
    showError(`Failed to analyze resume with local Ollama. ${msg}`, () => {
      compareResumeWithRequirements();
    });
  } finally {
    setComparing(false);
  }
}

// ─── SECTION: Analysis Cards Interaction ───
export function onAnalysisGridClick(event, dom) {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const index = Number(target.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.analysisItems.length) {
    return;
  }

  const action = target.dataset.action;
  const item = state.analysisItems[index];

  if (action === "toggle") {
    item.type = item.type === "weakness" ? "strength" : "weakness";
    item.isEditing = false;
    saveState(showError);
    dlog("analysis card", "index", index, "action", action, "new", { type: item.type, text: item.text });
    renderAnalysisScreen();
    return;
  }

  if (action === "edit") {
    if (!item.isEditing) {
      state.analysisItems.forEach((card) => {
        card.isEditing = false;
      });
      item.isEditing = true;
      dlog("analysis card", "index", index, "action", action, "new", { type: item.type, text: item.text });
      renderAnalysisScreen();

      const editable = dom.analysisGrid.querySelector(`[data-role="analysis-text"][data-index="${index}"]`);
      if (editable) {
        editable.focus();
        document.execCommand("selectAll", false, null);
        document.getSelection()?.collapseToEnd();
      }
      return;
    }

    const editable = dom.analysisGrid.querySelector(`[data-role="analysis-text"][data-index="${index}"]`);
    const updatedText = editable ? editable.textContent.trim() : "";
    if (!updatedText) {
      showError("Analysis card text cannot be empty.");
      return;
    }

    item.text = updatedText;
    item.isEditing = false;
    saveState(showError);
    dlog("analysis card", "index", index, "action", action, "new", { type: item.type, text: item.text });
    renderAnalysisScreen();
  }
}
