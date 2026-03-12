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
        throw new Error(`Ollama returned HTTP ${response.status}.`);
      }

      const data = await response.json();
      const outputText = typeof data?.response === "string" ? data.response : "";
      clearTimeout(timeoutId);
      dlog("ollama response", tag, "success", "host", host, "chars", outputText.length);
      return outputText;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error?.name === "AbortError") {
        lastError = new Error("Request timed out after 180 seconds.");
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error("Unknown network error.");
      }
      dwarn("ollama response", tag, "error", lastError.message, "host", host);
    }
  }

  throw lastError || new Error("Please ensure Ollama is running on localhost:11434.");
}

// ─── SECTION: Prompt Builders ───
function buildRequirementsPrompt(query) {
  return [
    "You are an HR requirement extraction engine.",
    "Return ONLY candidate requirements for the vacancy request.",
    "Output format MUST be plain text with requirements separated strictly by three semicolons: ;;;",
    "No numbering, no bullets, no JSON, no explanations, no extra words before or after.",
    "Each requirement must be short, specific, and job-relevant.",
    `Vacancy request: ${query}`
  ].join("\n");
}

function buildResumeAnalysisPrompt(requirements, resumeText) {
  return [
    "You are an HR analyst. Compare the resume below with the vacancy requirements.",
    "Return ONLY a list of STRENGTHS and WEAKNESSES, separated strictly by three semicolons (;;;).",
    "Format: Strength: [text];;;Weakness: [text];;;Strength: [text];;; etc.",
    "No extra words, no JSON, no explanations.",
    "Vacancy requirements:",
    requirements.map((item, idx) => `${idx + 1}. ${item}`).join("\n"),
    "Resume:",
    resumeText
  ].join("\n\n");
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
