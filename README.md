# Base Detective

Обучающая SQL-игра: детективные дела, которые решаются запросами к базе данных.

Прод: https://base-detective-zeta.vercel.app

## Стек

Vite + React + TypeScript + Tailwind, SQL-движок на sql.js в Web Worker.

## Запуск

```bash
npm install
npm run dev
```

## Дела

Дела лежат в `public/cases/NN.json` и грузятся по HTTP, минуя бандл.
Формат описан Zod-схемой в `src/core/types.ts`.

```bash
npm run validate:cases
```

Проверяет каждое дело по схеме и выполняет его SQL в SQLite: `schema` + `seed`
должны отработать, эталон каждого шага — вернуть непустой результат
(и на `seed`, и на `shadow_seed`).

## Тесты

```bash
npm test
```

`core/checker.ts` — проверка ответа игрока: пять режимов (`resultset`, `shadow`,
`require`/`forbid`, `schema`, `rowcount`), покрыты Vitest-тестами.

## Интерфейс

Терминал (CodeMirror 6 + автодополнение по схеме дела), таблица результата,
панель дела и подсказки — `src/ui/`. Пока показывает только одно дело (`00`),
без списка и роутинга — это фаза 5.

## Лицензия

Код — MIT ([LICENSE](./LICENSE)), контент дел — CC BY-SA 4.0 ([LICENSE-CONTENT](./LICENSE-CONTENT)).
