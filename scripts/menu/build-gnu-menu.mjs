import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_CONFIG = {
  campus: "칠암캠퍼스",
  restaurant: "학생식당",
  schSysId: "cdorm",
  mi: "1342",
  restSeq: "8"
};

const DEFAULT_OUTPUT = "data/gnu-menu.json";
const DEFAULT_WEEK_OFFSETS = [-7, 0, 7];
function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    input: null,
    date: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output") {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--input") {
      options.input = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--date") {
      options.date = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey, offset) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function getAnchorDateKey(inputDateKey) {
  if (inputDateKey) return inputDateKey;
  return toDateKey(new Date());
}

function buildSourceUrl(dateKey) {
  const url = new URL("https://www.gnu.ac.kr/main/ad/fm/foodmenu/selectFoodMenuView.do");
  url.searchParams.set("schSysId", SOURCE_CONFIG.schSysId);
  url.searchParams.set("mi", SOURCE_CONFIG.mi);
  url.searchParams.set("restSeq", SOURCE_CONFIG.restSeq);
  url.searchParams.set("schDt", dateKey);
  return url.toString();
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(value = "") {
  return decodeHtmlEntities(
    String(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractHeaderColumns(html) {
  const columns = [];
  const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/i);
  const theadHtml = theadMatch ? theadMatch[1] : html;
  const regex = /<th scope="col">([\s\S]*?)<\/th>/gi;

  for (const match of theadHtml.matchAll(regex)) {
    const plain = stripHtml(match[1]);
    const dateMatch = plain.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const weekday = plain.replace(dateMatch[1], "").trim();
    columns.push({
      dateKey: dateMatch[1],
      weekday
    });
  }

  return columns;
}

function getMealKey(label = "") {
  if (label.includes("아침") || label.includes("조식")) return "breakfast";
  if (label.includes("점심") || label.includes("중식")) return "lunch";
  if (label.includes("저녁") || label.includes("석식")) return "dinner";
  return null;
}

function extractCellItems(cellHtml = "") {
  const paragraphMatches = [...String(cellHtml).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const rawBlocks = paragraphMatches.length ? paragraphMatches.map((match) => match[1]) : [cellHtml];
  const items = [];

  for (const rawBlock of rawBlocks) {
    const text = stripHtml(rawBlock);
    if (!text) continue;
    for (const line of text.split("\n")) {
      const cleaned = line.trim();
      if (cleaned) items.push(cleaned);
    }
  }

  return items;
}

function parseWeeklyMenu(html, sourceUrl) {
  const columns = extractHeaderColumns(html);
  if (!columns.length) {
    throw new Error("Failed to parse menu date columns from source HTML.");
  }

  const menus = {};
  const rowRegex = /<tr>\s*<th scope="row">([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/gi;

  for (const match of html.matchAll(rowRegex)) {
    const rowLabel = stripHtml(match[1]);
    const mealKey = getMealKey(rowLabel);
    if (!mealKey) continue;

    const cells = [...match[2].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cellMatch) => extractCellItems(cellMatch[1]));
    if (!cells.length) continue;

    columns.forEach((column, index) => {
      if (!menus[column.dateKey]) {
        menus[column.dateKey] = {
          weekday: column.weekday,
          sourceUrl,
          breakfast: [],
          lunch: [],
          dinner: []
        };
      }
      menus[column.dateKey][mealKey] = cells[index] || [];
    });
  }

  return menus;
}

async function fetchWeeklyHtml(dateKey) {
  const sourceUrl = buildSourceUrl(dateKey);
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source menu: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return { html, sourceUrl };
}

function buildOutputPayload(menus, updatedAt) {
  const sortedMenus = Object.fromEntries(
    Object.entries(menus).sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
  );

  return {
    botName: "식단봇",
    updatedAt,
    location: {
      ...SOURCE_CONFIG
    },
    availableDates: Object.keys(sortedMenus),
    commands: [
      "/석식",
      "/석식 오늘",
      "/석식 2026-04-01",
      "/저녁 4/1"
    ],
    menus: sortedMenus
  };
}

async function ensureOutputDirectory(outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const anchorDateKey = getAnchorDateKey(options.date);
  const mergedMenus = {};
  const updatedAt = new Date().toISOString();

  if (options.input) {
    const html = await readFile(options.input, "utf8");
    Object.assign(mergedMenus, parseWeeklyMenu(html, buildSourceUrl(anchorDateKey)));
  } else {
    for (const offset of DEFAULT_WEEK_OFFSETS) {
      const requestedDate = addDays(anchorDateKey, offset);
      const { html, sourceUrl } = await fetchWeeklyHtml(requestedDate);
      Object.assign(mergedMenus, parseWeeklyMenu(html, sourceUrl));
    }
  }

  const payload = buildOutputPayload(mergedMenus, updatedAt);
  await ensureOutputDirectory(options.output);
  await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const firstDate = payload.availableDates[0] || "없음";
  const lastDate = payload.availableDates[payload.availableDates.length - 1] || "없음";
  console.log(`GNU menu cache written to ${options.output}`);
  console.log(`Available range: ${firstDate} ~ ${lastDate}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
