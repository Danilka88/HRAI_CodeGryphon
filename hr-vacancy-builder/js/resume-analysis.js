// ─── SECTION: Imports ───
import { DEFAULT_MODEL, derror, dlog } from "./config.js";
import {
  createAnalysisRecord,
  updateAnalysisRecord
} from "./indexeddb.js";
import { generateResumeAnalysis } from "./ollama-api.js";
import { saveState, state } from "./state.js";
import {
  parseAnalysisResponse,
  showError,
  hideError,
  buildAnalysisMarkdown
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
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

async function persistAnalysisSnapshot() {
  const markdown = buildAnalysisMarkdown(state);
  const payload = {
    vacancyId: Number.isInteger(state.activeVacancyId) ? state.activeVacancyId : null,
    query: state.query,
    model: state.model,
    resumeText: state.resumeText,
    analysisItems: state.analysisItems,
    markdown
  };

  if (Number.isInteger(state.activeAnalysisId)) {
    await updateAnalysisRecord(state.activeAnalysisId, payload);
    dlog("indexeddb", "analysis updated", state.activeAnalysisId);
    return state.activeAnalysisId;
  }

  const createdId = await createAnalysisRecord(payload);
  state.activeAnalysisId = createdId;
  dlog("indexeddb", "analysis created", createdId);
  return createdId;
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
      showError("PDF загружен для предпросмотра. Для анализа вставьте текст резюме вручную.");
      return;
    }

    resetPdfPreview();
    if (!isText) {
      throw new Error("Неподдерживаемый тип файла. Используйте .txt, .md или .pdf.");
    }

    const text = (await readFileAsText(file)).replace(/\r/g, "").trim();
    if (!text) {
      throw new Error("Загруженный файл пуст.");
    }

    state.resumeText = text;
    saveState();
    dom.resumeInput.value = text;
    dlog("upload", "text loaded", "chars", text.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Не удалось обработать загруженный файл.";
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
    showError("Нет утвержденных требований. Сначала сформируйте документ.");
    return;
  }

  if (!resumeText) {
    showError("Вставьте текст резюме (или загрузите .txt/.md) перед сравнением.");
    return;
  }

  state.model = model;
  saveState();
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
    saveState();
    dlog("analysis", "parsed items", parsed.length);

    let persistenceWarning = "";
    try {
      await persistAnalysisSnapshot();
      saveState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Не удалось сохранить анализ в архив.";
      derror("indexeddb", "save analysis", "error", msg);
      persistenceWarning = `Анализ сформирован, но сохранить его в архив не удалось. ${msg}`;
    }

    renderAnalysisScreen();
    if (persistenceWarning) {
      showError(persistenceWarning);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Неизвестная ошибка.";
    derror("analysis", "error", msg);
    showError(`Не удалось выполнить анализ резюме через локальную Ollama. ${msg}`, () => {
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
    saveState();
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
      showError("Текст карточки анализа не может быть пустым.");
      return;
    }

    item.text = updatedText;
    item.isEditing = false;
    saveState();
    dlog("analysis card", "index", index, "action", action, "new", { type: item.type, text: item.text });
    renderAnalysisScreen();
  }
}
