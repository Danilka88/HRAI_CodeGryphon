# HR Vacancy Builder (ES Modules)

## Run locally

```bash
python3 -m http.server 8000
```

Open:

- `http://localhost:8000/hr-vacancy-builder/`

## Requirements

- Browser with ES Modules support
- Local Ollama running on:
  - `http://localhost:11434`
  - fallback: `http://127.0.0.1:11434`

## Project structure

- `index.html` — UI markup + Tailwind CDN + module entry
- `js/config.js` — constants, DEBUG logging, URLs, IndexedDB config
- `js/indexeddb.js` — IndexedDB initialization + CRUD for vacancies/analyses + history API
- `js/state.js` — runtime app state and screen-level UI state
- `js/utils.js` — parsing, markdown builders, errors, downloads
- `js/ollama-api.js` — Ollama API calls for requirements + resume analysis
- `js/ui-renderer.js` — UI rendering for input/cards/preview/analysis/archive screens
- `js/resume-analysis.js` — resume upload + analysis generation + autosave into IndexedDB
- `js/main.js` — app bootstrap, navigation, event wiring, archive actions

## Storage and archive behavior

- App data is persisted in browser `IndexedDB` database: `hrVacancyDB`
- Object stores:
  - `vacancies` — saved vacancy requirements snapshots
  - `analyses` — saved resume analysis snapshots
- Vacancy snapshot is auto-saved after **Create document**
- Analysis snapshot is auto-saved after **Compare resume with requirements**
- Archive screen supports:
  - filtering (all / vacancies / analyses)
  - select / open / edit (open for editing in workflow screens)
  - delete single record
  - clear full archive

## Notes

- Response parsing uses strict `;;;` delimiter
- DEBUG logs are preserved with `[HR-VB]` prefix
- Functionality and UI flow are preserved:
  1. Input
  2. Cards
  3. Preview
  4. Resume Analysis
  5. Archive
