// ─── SECTION: Imports ───
import { DEFAULT_MODEL } from "./config.js";

// ─── SECTION: Prompt Builders ───
export function buildRequirementsPrompt(query) {
  return [
    "Ты — эксперт по требованиям к вакансиям.",
    "Верни ТОЛЬКО список требований к кандидату для указанной вакансии.",
    "Формат: каждое требование отделяется строго тремя точками с запятой ;;;",
    "Никакого другого текста, номеров, JSON, пояснений, вступлений и окончаний.",
    "Пример: Требование 1;;;Требование 2;;;Требование 3",
    "",
    `Вакансия: ${query}`
  ].join("\n");
}

export function buildResumeAnalysisPrompt(requirements, resumeText) {
  return [
    "Ты — HR-аналитик.",
    "Сравни резюме кандидата с требованиями вакансии.",
    "Верни ТОЛЬКО список сильных и слабых сторон в формате:",
    "",
    "Сильная сторона: [текст];;;Слабая сторона: [текст];;;Сильная сторона: [текст];;;",
    "",
    "Никаких других слов, заголовков, пояснений, нумерации, JSON. Только пункты через ;;;",
    "",
    "Требования вакансии:",
    requirements.map((item, idx) => `${idx + 1}. ${item}`).join("\n"),
    "",
    "Резюме кандидата:",
    resumeText
  ].join("\n");
}

export function buildBestVersionPrompt(query, vacancies) {
  const vacancyLines = vacancies
    .map((vacancy, index) => {
      const requirements = Array.isArray(vacancy?.items)
        ? vacancy.items
          .filter((item) => item && item.status !== "rejected" && typeof item.text === "string" && item.text.trim())
          .map((item) => `- ${item.text.trim()}`)
          .join("\n")
        : "";

      const safeRequirements = requirements || "- Нет утвержденных требований";
      return [
        `КАНДИДАТ_${index + 1}_ID: ${Number(vacancy?.id) || 0}`,
        `КАНДИДАТ_${index + 1}_МОДЕЛЬ: ${typeof vacancy?.model === "string" && vacancy.model.trim() ? vacancy.model.trim() : DEFAULT_MODEL}`,
        `КАНДИДАТ_${index + 1}_ТРЕБОВАНИЯ:`,
        safeRequirements
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Ты — старший HR-эксперт по качеству текстов вакансий.",
    "Нужно выбрать ЛУЧШУЮ версию вакансии среди кандидатов с одинаковым запросом.",
    "Верни ответ строго в формате из 3 частей через ;;; без дополнительных слов:",
    "BEST_ID: <числовой id лучшей вакансии>;;;BEST_TEXT: <кратко лучшая версия 1-3 предложения>;;;WHY_NOT_OTHERS: <почему остальные хуже, 1-3 предложения>",
    "Запрещено добавлять markdown, JSON, списки, вступления и заключения.",
    "",
    `Запрос вакансии: ${query}`,
    "",
    "Кандидаты:",
    vacancyLines
  ].join("\n");
}
