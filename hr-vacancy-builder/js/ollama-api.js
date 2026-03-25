// ─── SECTION: Imports ───
import {
  DEFAULT_MODEL,
  FALLBACK_OLLAMA_URL,
  GENERATE_TIMEOUT_MS,
  OLLAMA_URL,
  dlog,
  dwarn
} from "./config.js";
import {
  buildBestVersionPrompt,
  buildCompensationInsightsPrompt,
  buildRequirementsPrompt,
  buildResumeAnalysisPrompt
} from "./prompts.js";

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

export async function generateCompensationInsights({ query, model }) {
  const selectedModel = model || DEFAULT_MODEL;
  const prompt = buildCompensationInsightsPrompt(query);
  return callOllamaGenerate(prompt, selectedModel, "compensation-insights");
}

export async function generateBestVersionChoice({ query, vacancies, model }) {
  const selectedModel = model || DEFAULT_MODEL;
  const prompt = buildBestVersionPrompt(query, Array.isArray(vacancies) ? vacancies : []);
  return callOllamaGenerate(prompt, selectedModel, "best-version");
}
