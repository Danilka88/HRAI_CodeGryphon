// ─── SECTION: Imports ───
import { DEFAULT_MODEL } from "./config.js";
import {
  getCurrentScreen,
  setLastMarkdown,
  state
} from "./state.js";
import { buildMarkdown } from "./utils.js";

// ─── SECTION: DOM Context ───
let dom = null;

export function initUIRenderer(nextDom) {
  dom = nextDom;
}

// ─── SECTION: UI State Helpers ───
export function setGenerating(isGenerating) {
  if (!dom) {
    return;
  }

  dom.generateButton.disabled = isGenerating;
  dom.generateButton.textContent = isGenerating ? "Генерация..." : "Сгенерировать требования";
  dom.inputHint.textContent = isGenerating
    ? "Ожидание ответа от локальной Ollama (до 180 секунд)..."
    : "Данные сохраняются только в localStorage вашего браузера.";
}

export function setComparing(isComparing) {
  if (!dom) {
    return;
  }

  dom.compareButton.disabled = isComparing;
  dom.compareButton.textContent = isComparing ? "Сравнение..." : "Сравнить резюме с требованиями";
}

export function resetPdfPreview() {
  if (!dom) {
    return;
  }

  dom.pdfPreview.removeAttribute("src");
  dom.pdfPreviewWrap.classList.add("hidden");
}

// ─── SECTION: Card Renderers ───
export function renderCard(item, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "card-transition rounded-xl border bg-white p-4 shadow-sm";

  if (item.status === "rejected") {
    wrapper.classList.add("border-rose-300", "bg-rose-50");
  } else {
    wrapper.classList.add("border-slate-200");
  }

  const textBlock = document.createElement("div");
  textBlock.className = "min-h-20 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800";
  textBlock.contentEditable = item.isEditing ? "true" : "false";
  textBlock.textContent = item.text;
  textBlock.dataset.index = String(index);
  textBlock.dataset.role = "card-text";
  if (!item.isEditing) {
    textBlock.classList.add("select-text");
  }

  const statusLine = document.createElement("p");
  statusLine.className = "mt-2 text-xs font-medium";
  statusLine.textContent = item.status === "rejected" ? "Отклонено" : "Утверждено";
  statusLine.classList.add(item.status === "rejected" ? "text-rose-700" : "text-emerald-700");

  const buttons = document.createElement("div");
  buttons.className = "mt-3 flex flex-wrap gap-2";

  const approveButton = document.createElement("button");
  approveButton.type = "button";
  approveButton.dataset.action = "approve";
  approveButton.dataset.index = String(index);
  approveButton.className = "inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700";
  approveButton.textContent = "✅ Утвердить";

  const rejectButton = document.createElement("button");
  rejectButton.type = "button";
  rejectButton.dataset.action = "reject";
  rejectButton.dataset.index = String(index);
  rejectButton.className = "inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700";
  rejectButton.textContent = "❌ Отклонить";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.dataset.index = String(index);
  editButton.className = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100";
  editButton.textContent = item.isEditing ? "💾 Сохранить" : "✏️ Редактировать";

  buttons.append(approveButton, rejectButton, editButton);
  wrapper.append(textBlock, statusLine, buttons);
  return wrapper;
}

export function renderAnalysisCard(item, index) {
  const weak = item.type === "weakness";
  const wrapper = document.createElement("div");
  wrapper.className = `card-transition rounded-xl border p-4 shadow-sm ${weak ? "border-rose-300 bg-rose-50" : "border-emerald-300 bg-emerald-50"}`;

  const badge = document.createElement("p");
  badge.className = `mb-2 text-xs font-semibold ${weak ? "text-rose-700" : "text-emerald-700"}`;
  badge.textContent = weak ? "❌ Слабая сторона" : "✅ Сильная сторона";

  const textBlock = document.createElement("div");
  textBlock.className = "min-h-20 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800";
  textBlock.contentEditable = item.isEditing ? "true" : "false";
  textBlock.textContent = item.text;
  textBlock.dataset.role = "analysis-text";
  textBlock.dataset.index = String(index);
  if (!item.isEditing) {
    textBlock.classList.add("select-text");
  }

  const buttons = document.createElement("div");
  buttons.className = "mt-3 flex flex-wrap gap-2";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.dataset.action = "toggle";
  toggleButton.dataset.index = String(index);
  toggleButton.className = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100";
  toggleButton.textContent = weak ? "Пометить как сильную" : "Пометить как слабую";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.dataset.index = String(index);
  editButton.className = "inline-flex items-center justify-center rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800";
  editButton.textContent = item.isEditing ? "💾 Сохранить" : "✏️ Редактировать";

  buttons.append(toggleButton, editButton);
  wrapper.append(badge, textBlock, buttons);
  return wrapper;
}

// ─── SECTION: Screen Renderers ───
export function renderInputScreen() {
  dom.screenInput.classList.remove("hidden");
  dom.screenInput.classList.add("flex");
  dom.screenCards.classList.add("hidden");
  dom.screenPreview.classList.add("hidden");
  dom.screenAnalysis.classList.add("hidden");

  dom.queryInput.value = state.query || "";
  dom.modelSelect.value = state.model || DEFAULT_MODEL;
  setGenerating(false);
}

export function renderCardsScreen() {
  dom.screenInput.classList.add("hidden");
  dom.screenCards.classList.remove("hidden");
  dom.screenCards.classList.add("flex");
  dom.screenPreview.classList.add("hidden");
  dom.screenAnalysis.classList.add("hidden");

  dom.cardsGrid.innerHTML = "";
  state.items.forEach((item, index) => {
    dom.cardsGrid.appendChild(renderCard(item, index));
  });

  dom.cardsMetaCount.textContent = String(state.items.length);
  dom.createDocumentButton.disabled = state.items.filter((item) => item.status !== "rejected" && item.text.trim()).length === 0;
}

export function renderPreviewScreen() {
  dom.screenInput.classList.add("hidden");
  dom.screenCards.classList.add("hidden");
  dom.screenPreview.classList.remove("hidden");
  dom.screenPreview.classList.add("flex");
  dom.screenAnalysis.classList.add("hidden");

  const markdown = buildMarkdown(state);
  setLastMarkdown(markdown);
  dom.markdownPreview.textContent = markdown;
}

export function renderAnalysisScreen() {
  dom.screenInput.classList.add("hidden");
  dom.screenCards.classList.add("hidden");
  dom.screenPreview.classList.add("hidden");
  dom.screenAnalysis.classList.remove("hidden");
  dom.screenAnalysis.classList.add("flex");

  dom.resumeInput.value = state.resumeText || "";
  dom.analysisGrid.innerHTML = "";
  state.analysisItems.forEach((item, index) => {
    dom.analysisGrid.appendChild(renderAnalysisCard(item, index));
  });

  dom.analysisMetaCount.textContent = String(state.analysisItems.length);
  dom.downloadAnalysisButton.disabled = !state.analysisItems.length;
  setComparing(false);
}

export function renderCurrentScreen() {
  const currentScreen = getCurrentScreen();

  if (currentScreen === "cards") {
    renderCardsScreen();
    return;
  }

  if (currentScreen === "preview") {
    renderPreviewScreen();
    return;
  }

  if (currentScreen === "analysis") {
    renderAnalysisScreen();
    return;
  }

  renderInputScreen();
}
