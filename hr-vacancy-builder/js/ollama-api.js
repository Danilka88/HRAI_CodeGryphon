// ─── SECTION: Imports ───
import {
  DEFAULT_MODEL,
  FALLBACK_OLLAMA_URL,
  GENERATE_TIMEOUT_MS,
  OLLAMA_URL,
  dlog,
  dwarn
} from "./config.js";

// ─── SECTION: Host Resolution ───
function getCandidateHosts() {
  const hosts = [OLLAMA_URL];
  if (OLLAMA_URL !== FALLBACK_OLLAMA_URL) {
    hosts.push(FALLBACK_OLLAMA_URL);
  }
  return hosts;
}

// ─── SECTION: Core Ollama Call ───
async function callOllamaGenerate(prompt, model, tag) {
  const payload = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.2,
      top_p: 0.9
    }
  };

  let lastError = null;
  const hosts = getCandidateHosts();

  dlog("ollama call", tag, "starting", "model", model, "hosts", hosts.length);
  for (const host of hosts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

    try {
      const response = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama вернула HTTP ${response.status}.`);
      }

      const data = await response.json();
      const outputText = typeof data?.response === "string" ? data.response : "";
      clearTimeout(timeoutId);
      dlog("ollama response", tag, "success", "host", host, "chars", outputText.length);
      return outputText;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error?.name === "AbortError") {
        lastError = new Error("Превышено время ожидания: 180 секунд.");
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error("Неизвестная сетевая ошибка.");
      }
      dwarn("ollama response", tag, "error", lastError.message, "host", host);
    }
  }

  throw lastError || new Error("Убедитесь, что Ollama запущена на localhost:11434.");
}

// ─── SECTION: Prompt Builders ───
function buildRequirementsPrompt(query) {
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

function buildResumeAnalysisPrompt(requirements, resumeText) {
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

// ─── SECTION: Public API ───
export async function generateRequirements({ query, model }) {
  const selectedModel = model || DEFAULT_MODEL;
  const prompt = buildRequirementsPrompt(query);
  return callOllamaGenerate(prompt, selectedModel, "requirements");
}

export async function generateResumeAnalysis({ requirements, resumeText, model }) {
  const selectedModel = model || DEFAULT_MODEL;
  const prompt = buildResumeAnalysisPrompt(requirements, resumeText);
  return callOllamaGenerate(prompt, selectedModel, "analysis");
}
