// ─── SECTION: Imports ───
import { HH_API_BASE_URL, HH_REQUEST_TIMEOUT_MS, derror, dlog, dwarn } from "./config.js";

// ─── SECTION: Demo Fixtures ───
const DEMO_RESUMES = [
  {
    id: "demo-1",
    name: "Иван Петров",
    title: "Python Backend Developer",
    employer: "Demo Fintech",
    area: "Москва",
    updatedAt: "2026-03-12T10:20:00Z",
    url: "https://hh.ru/resume/demo-1",
    resumeText: [
      "Кандидат: Иван Петров",
      "Позиция: Python Backend Developer",
      "Опыт: 6 лет",
      "Стек: Python, FastAPI, PostgreSQL, Redis, Docker",
      "Достижения: снизил latency API на 35%, внедрил CI/CD, покрыл критичный сервис тестами до 82%",
      "Локация: Москва"
    ].join("\n")
  },
  {
    id: "demo-2",
    name: "Анна Смирнова",
    title: "Senior Python Developer",
    employer: "Demo HealthTech",
    area: "Москва",
    updatedAt: "2026-03-14T09:40:00Z",
    url: "https://hh.ru/resume/demo-2",
    resumeText: [
      "Кандидат: Анна Смирнова",
      "Позиция: Senior Python Developer",
      "Опыт: 8 лет",
      "Стек: Python, Django, Celery, Kafka, Kubernetes",
      "Достижения: построила event-driven интеграцию 12 сервисов, сократила ошибки синхронизации на 48%",
      "Локация: Москва"
    ].join("\n")
  },
  {
    id: "demo-3",
    name: "Дмитрий Соколов",
    title: "Java Developer",
    employer: "Demo Retail",
    area: "Санкт-Петербург",
    updatedAt: "2026-03-10T16:05:00Z",
    url: "https://hh.ru/resume/demo-3",
    resumeText: [
      "Кандидат: Дмитрий Соколов",
      "Позиция: Java Developer",
      "Опыт: 5 лет",
      "Стек: Java, Spring Boot, PostgreSQL, RabbitMQ",
      "Достижения: реализовал миграцию на микросервисную архитектуру и уменьшил время релиза с 2 недель до 3 дней",
      "Локация: Санкт-Петербург"
    ].join("\n")
  }
];

// ─── SECTION: Helpers ───
function toSafeString(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeSearchQuery(value) {
  return toSafeString(value).trim() || "NAME:Python";
}

function normalizeArea(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1;
}

function normalizePerPage(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return 20;
  }

  return Math.min(numeric, 100);
}

function includeByQuery(item, query) {
  const normalizedQuery = query.toLowerCase();
  const searchable = `${item.name} ${item.title} ${item.employer} ${item.area}`.toLowerCase();
  return searchable.includes(normalizedQuery.replace(/^name:/i, "").trim());
}

function normalizeHhItem(item, index) {
  const safeId = toSafeString(item?.id).trim() || `api-${Date.now()}-${index}`;
  const name = toSafeString(item?.name).trim() || "Без имени";

  return {
    id: safeId,
    name,
    title: toSafeString(item?.title || item?.position).trim() || name,
    employer: toSafeString(item?.employer?.name || item?.employer_name).trim() || "Не указан",
    area: toSafeString(item?.area?.name || item?.area_name).trim() || "Не указан",
    updatedAt: toSafeString(item?.updated_at || item?.published_at).trim() || "",
    url: toSafeString(item?.url || item?.alternate_url).trim(),
    resumeText: "",
    raw: item
  };
}

function buildDemoResumes(query, perPage) {
  const normalizedQuery = normalizeSearchQuery(query);
  const limited = DEMO_RESUMES
    .filter((item) => includeByQuery(item, normalizedQuery))
    .slice(0, normalizePerPage(perPage));

  return limited.length ? limited : DEMO_RESUMES.slice(0, normalizePerPage(perPage));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchHhApiResumes({ query, area, perPage, apiKey }) {
  const params = new URLSearchParams({
    text: normalizeSearchQuery(query),
    area: String(normalizeArea(area)),
    per_page: String(normalizePerPage(perPage))
  });

  const endpoint = `${HH_API_BASE_URL}/resumes?${params.toString()}`;
  dlog("hh", "request", endpoint.replace(apiKey, "***"));

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HH-User-Agent": "HR-Vacancy-Builder/1.0 (web-client)"
      }
    },
    HH_REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`hh.ru API вернул статус ${response.status}.`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const mappedItems = items.map(normalizeHhItem).filter((item) => item.id && item.name);

  return mappedItems.slice(0, normalizePerPage(perPage));
}

// ─── SECTION: Public API ───
export async function requestResumesFromHh(options = {}) {
  const query = normalizeSearchQuery(options.query);
  const area = normalizeArea(options.area);
  const perPage = normalizePerPage(options.perPage);
  const useDemo = options.useDemo !== false;
  const apiKey = toSafeString(options.apiKey).trim();

  if (useDemo) {
    const items = buildDemoResumes(query, perPage);
    dlog("hh", "demo mode", "query", query, "items", items.length);
    return {
      source: "demo",
      items,
      notice: "Включен демо-режим hh.ru."
    };
  }

  if (!apiKey) {
    const fallback = buildDemoResumes(query, perPage);
    dwarn("hh", "api key missing, fallback to demo");
    return {
      source: "demo",
      items: fallback,
      notice: "API-ключ hh.ru не указан. Загружены демо-резюме."
    };
  }

  try {
    const items = await fetchHhApiResumes({ query, area, perPage, apiKey });
    dlog("hh", "api mode", "items", items.length);

    if (!items.length) {
      return {
        source: "api",
        items: [],
        notice: "hh.ru не вернул резюме по указанному запросу."
      };
    }

    return {
      source: "api",
      items,
      notice: "Резюме загружены из hh.ru API."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка запроса к hh.ru API.";
    derror("hh", "api error", message);

    const fallback = buildDemoResumes(query, perPage);
    return {
      source: "demo",
      items: fallback,
      notice: `Не удалось получить данные hh.ru (${message}). Загружены демо-резюме.`
    };
  }
}

export function formatHhResumeForTextarea(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  if (typeof item.resumeText === "string" && item.resumeText.trim()) {
    return item.resumeText.trim();
  }

  const lines = [
    `Кандидат: ${toSafeString(item.name).trim() || "Не указан"}`,
    `Позиция: ${toSafeString(item.title).trim() || "Не указана"}`,
    `Компания: ${toSafeString(item.employer).trim() || "Не указана"}`,
    `Локация: ${toSafeString(item.area).trim() || "Не указана"}`
  ];

  const url = toSafeString(item.url).trim();
  if (url) {
    lines.push(`Ссылка на hh.ru: ${url}`);
  }

  const updatedAt = toSafeString(item.updatedAt).trim();
  if (updatedAt) {
    lines.push(`Обновлено: ${updatedAt}`);
  }

  return lines.join("\n");
}
