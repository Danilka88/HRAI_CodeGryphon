export const APP_TEMPLATE = `
<div id="app" class="min-h-screen">
  <header class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <h1 class="text-lg font-semibold sm:text-xl">Конструктор требований к вакансии</h1>
      <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Локальная Ollama</span>
    </div>
  </header>

  <nav class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
    <div
      class="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div class="flex flex-wrap items-center gap-2">
        <button id="globalNavNewButton" type="button"
          class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
          Новая вакансия
        </button>
        <button id="globalNavCompensationButton" type="button"
          class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
          Зарплата и условия
        </button>
        <button id="globalNavArchiveButton" type="button"
          class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          Архив
        </button>
      </div>
      <p id="globalCurrentVacancy" class="text-xs text-slate-600 lg:text-sm">
        Текущая вакансия: не выбрана
      </p>
    </div>
  </nav>

  <main class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <section id="globalError" class="hidden mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-sm font-semibold">Что-то пошло не так</p>
          <p id="globalErrorMessage" class="mt-1 text-sm leading-relaxed"></p>
        </div>
        <button id="retryButton" type="button"
          class="hidden inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
          Повторить
        </button>
      </div>
    </section>

    <section id="screenInput" class="flex flex-col gap-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold">1) Введите запрос по вакансии</h2>
            <p class="mt-2 text-sm text-slate-600">
              Пример: <span class="font-medium">Детский стоматолог для клиники детской медицины</span>
            </p>
          </div>
          <button id="openArchiveButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Открыть архив
          </button>
        </div>

        <label for="queryInput" class="mt-5 block text-sm font-medium text-slate-700">Запрос по вакансии</label>
        <textarea id="queryInput" rows="4" placeholder="Введите описание вакансии..."
          class="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"></textarea>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label for="modelSelect" class="block text-sm font-medium text-slate-700">Модель Ollama</label>
            <select id="modelSelect"
              class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="qwen3.5:0.8b">qwen3.5:0.8b</option>
              <option value="gemma3:4b">gemma3:4b</option>
              <option value="qwen3.5:4b">qwen3.5:4b</option>
            </select>
          </div>
          <div class="flex items-end">
            <button id="generateButton" type="button"
              class="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300">
              Сгенерировать требования
            </button>
          </div>
        </div>

        <div id="inputHint" class="mt-4 text-xs text-slate-500">
          Данные сохраняются в архиве IndexedDB текущего браузера.
        </div>
      </div>
    </section>

    <section id="screenCompensation" class="hidden flex-col gap-6">
      <div class="rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-2">
          <h2 class="text-xl font-semibold">Оценка зарплаты и условий найма</h2>
          <p class="text-sm text-slate-600">Введите роль (например, «Стоматолог»), и Ollama оценит примерную зарплату и рекомендации по условиям для повышения шанса найма.</p>
        </div>

        <label for="compensationQueryInput" class="mt-5 block text-sm font-medium text-slate-700">Роль / специализация</label>
        <input id="compensationQueryInput" type="text" placeholder="Например: Стоматолог"
          class="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label for="compensationModelSelect" class="block text-sm font-medium text-slate-700">Модель Ollama</label>
            <select id="compensationModelSelect"
              class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
              <option value="qwen3.5:0.8b">qwen3.5:0.8b</option>
              <option value="gemma3:4b">gemma3:4b</option>
              <option value="qwen3.5:4b">qwen3.5:4b</option>
            </select>
          </div>
          <div class="flex items-end">
            <button id="compensationAnalyzeButton" type="button"
              class="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-cyan-300">
              Оценить условия найма
            </button>
          </div>
        </div>

        <p id="compensationStatus" class="mt-4 text-xs text-slate-500">Результаты появятся после анализа через локальную Ollama.</p>

        <div class="mt-6 grid gap-4 lg:grid-cols-3">
          <article class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 class="text-sm font-semibold text-emerald-800">Ориентир по зарплате</h3>
            <p id="compensationSalaryRange" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-emerald-900">—</p>
          </article>
          <article class="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 class="text-sm font-semibold text-blue-800">Условия для соискателя</h3>
            <p id="compensationCompanyConditions" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-blue-900">—</p>
          </article>
          <article class="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <h3 class="text-sm font-semibold text-violet-800">Что усилить в найме</h3>
            <p id="compensationHiringRecommendations" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-violet-900">—</p>
          </article>
        </div>
      </div>
    </section>

    <section id="screenCards" class="hidden flex-col gap-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold">2) Проверьте и отредактируйте требования</h2>
            <p class="mt-1 text-sm text-slate-600">Подтвердите, отклоните или отредактируйте каждое требование перед
              созданием документа.</p>
          </div>
          <div class="text-xs text-slate-500">
            Всего пунктов: <span id="cardsMetaCount">0</span>
          </div>
        </div>

        <div id="cardsGrid" class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"></div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button id="backToInputButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Назад
          </button>
          <button id="createDocumentButton" type="button"
            class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-300">
            Создать документ
          </button>
        </div>
      </div>
    </section>

    <section id="screenPreview" class="hidden flex-col gap-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold">3) Финальный предпросмотр Markdown</h2>
        <p class="mt-2 text-sm text-slate-600">Скачайте готовый .md документ и передайте его рекрутеру или нанимающему
          менеджеру.</p>

        <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <pre id="markdownPreview" class="markdown-preview text-sm leading-relaxed text-slate-800"></pre>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button id="downloadButton" type="button"
            class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
            Скачать .md
          </button>
          <button id="downloadCsvButton" type="button"
            class="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
            Скачать .csv
          </button>
          <button id="nextToAnalysisButton" type="button"
            class="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
            Далее: Анализ резюме кандидата
          </button>
          <button id="startOverButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Начать заново
          </button>
        </div>
      </div>
    </section>

    <section id="screenAnalysis" class="hidden flex-col gap-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold">4) Анализ резюме</h2>
            <p class="mt-1 text-sm text-slate-600">Вставьте текст резюме или загрузите файл, затем сравните его с
              утвержденными требованиями.</p>
          </div>
          <div class="text-xs text-slate-500">Карточек анализа: <span id="analysisMetaCount">0</span></div>
        </div>

        <label for="resumeInput" class="mt-5 block text-sm font-medium text-slate-700">Текст резюме</label>
        <textarea id="resumeInput" rows="10" placeholder="Вставьте текст резюме кандидата..."
          class="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"></textarea>

        <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="text-sm font-semibold text-slate-800">Импорт резюме из hh.ru</h3>
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input id="hhUseDemoCheckbox" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked />
              Использовать демо-данные (по умолчанию)
            </label>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="sm:col-span-2">
              <label for="hhApiKeyInput" class="block text-xs font-medium text-slate-700">API-ключ hh.ru</label>
              <input id="hhApiKeyInput" type="password" autocomplete="off" placeholder="Введите API-ключ (только для режима API)"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label for="hhSearchQueryInput" class="block text-xs font-medium text-slate-700">Поисковый запрос</label>
              <input id="hhSearchQueryInput" type="text" value="NAME:Python"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label for="hhAreaInput" class="block text-xs font-medium text-slate-700">Регион (area)</label>
              <input id="hhAreaInput" type="number" min="1" step="1" value="1"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label for="hhPerPageInput" class="block text-xs font-medium text-slate-700">Кол-во (per_page)</label>
              <input id="hhPerPageInput" type="number" min="1" max="100" step="1" value="20"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div class="flex items-end">
              <button id="hhFetchButton" type="button"
                class="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2">
                Загрузить резюме из hh.ru
              </button>
            </div>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label for="hhResumeSelect" class="block text-xs font-medium text-slate-700">Найденные резюме</label>
              <select id="hhResumeSelect"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">Сначала загрузите список резюме</option>
              </select>
            </div>
            <div class="flex items-end">
              <button id="hhApplyResumeButton" type="button"
                class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                Подставить выбранное
              </button>
            </div>
          </div>

          <p id="hhNotice" class="mt-3 text-xs text-slate-600">
            Демо-режим включён: используйте тестовые данные без API-ключа.
          </p>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div id="resumeDropzone"
            class="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 transition">
            <p class="font-medium text-slate-700">Перетащите .txt / .md / .pdf сюда</p>
            <p class="mt-1 text-xs">Или нажмите для загрузки. TXT/MD обрабатываются автоматически. Для PDF доступен
              только предпросмотр — вставьте текст вручную.</p>
            <input id="resumeFile" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              class="hidden" />
          </div>
          <div id="pdfPreviewWrap" class="hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
            <embed id="pdfPreview" type="application/pdf" class="h-44 w-full rounded-lg" />
          </div>
        </div>

        <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button id="compareButton" type="button"
            class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300">
            Сравнить резюме с требованиями
          </button>
          <div class="flex flex-col gap-3 sm:flex-row">
            <button id="downloadAnalysisButton" type="button"
              class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-300">
              Скачать Analysis.md
            </button>
            <button id="downloadAnalysisCsvButton" type="button"
              class="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-teal-300">
              Скачать Analysis.csv
            </button>
          </div>
        </div>

        <div id="analysisGrid" class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"></div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button id="backToPreviewButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Назад к предпросмотру
          </button>
          <button id="analysisStartOverButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Начать заново
          </button>
        </div>
      </div>
    </section>

    <section id="screenArchive" class="hidden flex-col gap-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold">Архив вакансий и анализов</h2>
            <p class="mt-1 text-sm text-slate-600">Откройте сохраненные записи, удалите отдельные элементы или очистите архив
              полностью.</p>
          </div>
          <div class="text-xs text-slate-500">Записей: <span id="historyMetaCount">0</span></div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label for="historyFilterSelect" class="block text-sm font-medium text-slate-700">Фильтр</label>
            <select id="historyFilterSelect"
              class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="all">Все записи</option>
              <option value="vacancies">Только вакансии</option>
              <option value="analyses">Только анализы</option>
            </select>
          </div>
          <div class="flex items-end sm:justify-end">
            <button id="clearHistoryButton" type="button"
              class="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 sm:w-auto">
              Очистить весь архив
            </button>
          </div>
        </div>

        <p id="historyEmpty" class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Архив пока пуст. Сохраните документ вакансии или результат анализа, чтобы увидеть их здесь.
        </p>

        <div id="historyGrid" class="mt-5 grid gap-4"></div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-start">
          <button id="backFromArchiveButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Вернуться в работу
          </button>
        </div>
      </div>
    </section>

    <section id="screenBestVersion" class="hidden flex-col gap-6">
      <div class="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-2">
          <h2 class="text-2xl font-bold text-slate-900">Лучшая версия вакансии</h2>
          <p id="bestVersionQueryTitle" class="text-sm text-slate-600">Вакансия: —</p>
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          <article class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 class="text-sm font-semibold text-emerald-800">Лучшая вакансия</h3>
            <p id="bestVersionBestBlock" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-emerald-900">—</p>
          </article>

          <article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 class="text-sm font-semibold text-slate-800">Почему не другие</h3>
            <p id="bestVersionWhyBlock" class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">—</p>
          </article>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button id="openBestVacancyButton" type="button"
            class="inline-flex items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
            Открыть лучшую вакансию
          </button>
          <button id="backToArchiveFromBestButton" type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Назад в архив
          </button>
        </div>
      </div>
    </section>
  </main>

  <div id="bestVersionLoadingOverlay"
    class="pointer-events-none fixed inset-0 z-40 hidden items-center justify-center bg-slate-900/20 px-4">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur-sm">
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        <p class="text-sm font-semibold text-slate-800">Ищем лучшую версию вакансии...</p>
        <p class="text-xs text-slate-500">Это займёт несколько секунд</p>
      </div>
    </div>
  </div>

  <div id="toastContainer" class="pointer-events-none fixed inset-x-0 bottom-4 z-50 hidden px-4 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-3xl">
      <div id="toastMessage"
        class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg">
      </div>
    </div>
  </div>
</div>
`;
