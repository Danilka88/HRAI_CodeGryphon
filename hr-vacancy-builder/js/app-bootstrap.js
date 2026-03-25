import { APP_TEMPLATE } from "./app-template.js";

function mountAppTemplate() {
  const root = document.getElementById("appRoot");

  if (!root) {
    throw new Error("Не найден контейнер #appRoot для монтирования приложения.");
  }

  root.innerHTML = APP_TEMPLATE.trim();
}

mountAppTemplate();
