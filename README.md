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
`require`/`forbid`, `schema`, `rowcount`). `core/errorDict.ts` — перевод сырых
сообщений SQLite на человеческий язык; правила из `Step.errors` перекрывают
общий словарь. Всё покрыто Vitest-тестами.

## Интерфейс

Терминал (CodeMirror 6 + автодополнение по схеме дела), таблица результата,
панель дела и подсказки — `src/ui/`.

Список дел на `/`, само дело на `/case/:id`. Прогресс — `core/storage.ts`
поверх `localStorage`, разблокировка последовательная: дело "NN" открывается,
как только пройдено "NN-1". Список дел читает `public/cases/index.json` —
отдельный от самих дел файл, потому что статический хостинг не отдаёт
листинг директории; `validate:cases` сверяет его с тем, что реально лежит
на диске.

## Лицензия

Код — MIT ([LICENSE](./LICENSE)), контент дел — CC BY-SA 4.0 ([LICENSE-CONTENT](./LICENSE-CONTENT)).
