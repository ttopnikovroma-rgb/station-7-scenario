// Сборка main.ink в build/main.json с проверкой ошибок.
// Запуск: npm run build   (нужен npm install — поставит inkjs)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler } from "inkjs/full";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "main.ink");
const outDir = path.join(root, "build");
const outPath = path.join(outDir, "main.json");

const source = fs.readFileSync(srcPath, "utf8");

const problems = [];
const compiler = new Compiler(source, {
  errorHandler: (message, type) => problems.push(`${type}: ${message}`),
});

let story = null;
try {
  story = compiler.Compile();
} catch (error) {
  problems.push(`исключение компилятора: ${String(error.message).slice(0, 200)}`);
}

if (problems.length) {
  console.error("Проблемы при компиляции:\n" + problems.join("\n"));
}

if (!story) {
  console.error("Компиляция не удалась.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, story.ToJson(), "utf8");

const stats = compiler.GenerateStats();
console.log(`Готово: ${path.relative(root, outPath)}`);
console.log(`Слов: ${stats.words}, узлов: ${stats.knots}, функций: ${stats.functions}, выборов: ${stats.choices}`);
