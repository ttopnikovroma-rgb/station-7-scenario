// Автопрогон сценария: ищет тупики, ошибки рантайма и недостижимые концовки.
// Запуск: npm run playtest

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler, Story } from "inkjs/full";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "main.ink"), "utf8");

const problems = [];
const compiler = new Compiler(source, {
  errorHandler: (m, t) => problems.push(`${t}: ${m}`),
});

let compiled = null;
try {
  compiled = compiler.Compile();
} catch (error) {
  problems.push(`исключение компилятора: ${String(error.message).slice(0, 200)}`);
}

if (!compiled) {
  console.error("Компиляция не удалась:\n" + problems.join("\n"));
  process.exit(1);
}

const json = compiled.ToJson();
const RUNS = Number(process.argv[2] || 300);
const MAX_DECISIONS = 400;

const endings = new Map();
const runtimeErrors = new Map();
let loops = 0;

function play(strategy, collectLog) {
  const story = new Story(json);
  const used = new Map();
  const log = [];
  let decisions = 0;

  story.onError = (message) => {
    throw new Error("RUNTIME " + message);
  };

  while (true) {
    while (story.canContinue) {
      const line = story.Continue();
      if (collectLog && line.trim()) log.push(line.trim());
    }
    if (story.currentChoices.length === 0) break;
    if (++decisions > MAX_DECISIONS) {
      const error = new Error("loop");
      error.loop = true;
      throw error;
    }

    const choices = story.currentChoices;
    let pool = choices.map((choice, index) => ({ index, text: choice.text }));

    if (strategy === "fresh") {
      const fresh = pool.filter((p) => !used.has(p.text));
      if (fresh.length) pool = fresh;
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    used.set(pick.text, (used.get(pick.text) || 0) + 1);
    if (collectLog) log.push("> " + pick.text);
    story.ChooseChoiceIndex(pick.index);
  }

  return { ending: story.variablesState["ending"], log };
}

for (const strategy of ["random", "fresh"]) {
  for (let i = 0; i < RUNS; i++) {
    try {
      const { ending } = play(strategy, false);
      const key = `${ending}`;
      endings.set(key, (endings.get(key) || 0) + 1);
    } catch (error) {
      if (error.loop) { loops++; continue; }
      const msg = error.message.replace(/^RUNTIME ERROR: /, "");
      runtimeErrors.set(msg, (runtimeErrors.get(msg) || 0) + 1);
    }
  }
}

// демонстрационный проход — чтобы глазами увидеть текст
const demo = play("fresh", true);

const total = RUNS * 2;
console.log(`Прохождений: ${total}`);
console.log(
  "Концовки: " +
    [...endings.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([code, count]) => `${code}×${count}`)
      .join(", ")
);
console.log(`Случайных «блужданий» без финала: ${loops} (это не ошибка — автотест ходит по кругу)`);

if (runtimeErrors.size) {
  console.error("\nОшибки рантайма:");
  for (const [message, count] of runtimeErrors) console.error(`  ${count}× ${message}`);
} else {
  console.log("Ошибки рантайма: нет");
}

console.log("\nПример прохождения (последние 15 строк):\n" + demo.log.slice(-15).join("\n"));

const known = ["10", "11", "12", "20", "21", "30", "31"];
const seen = known.filter((code) => endings.has(code));
console.log(`\nВстретились концовки: ${seen.join(", ")} из ${known.length}`);

process.exit(runtimeErrors.size ? 1 : 0);
