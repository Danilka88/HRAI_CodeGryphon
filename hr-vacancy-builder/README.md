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
- `js/config.js` — constants, DEBUG logging, URLs
- `js/state.js` — app state + localStorage load/save
- `js/utils.js` — parsing, markdown builders, errors, downloads
- `js/ollama-api.js` — Ollama API calls for requirements + resume analysis
- `js/ui-renderer.js` — all UI renderers for screens/cards
- `js/resume-analysis.js` — resume upload + analysis interactions
- `js/main.js` — app bootstrap + event wiring

## Notes

- localStorage key is preserved: `hr-vacancy-builder`
- Response parsing uses strict `;;;` delimiter
- DEBUG logs are preserved with `[HR-VB]` prefix
- Functionality and UI flow are preserved:
  1. Input
  2. Cards
  3. Preview
  4. Resume Analysis
