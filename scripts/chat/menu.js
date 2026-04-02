const DEFAULT_MENU_DATA_URL = "./data/gnu-menu.json";
const DEFAULT_BOT_NAME = "식단봇";
const CAMPUS_LABEL = "칠암캠퍼스";
const RESTAURANT_LABEL = "학생식당";
const MENU_CACHE_TTL_MS = 5 * 60 * 1000;

const mealAliasMap = new Map([
    ["아침", "breakfast"],
    ["조식", "breakfast"],
    ["점심", "lunch"],
    ["중식", "lunch"],
    ["저녁", "dinner"],
    ["석식", "dinner"]
]);

const mealLabelMap = {
    breakfast: "아침",
    lunch: "점심",
    dinner: "저녁"
};

const COMMAND_GUIDE_SECTIONS = [
    {
        title: "기본 조회",
        items: [
            { command: "/아침", description: "오늘 아침 메뉴를 보여줘요." },
            { command: "/점심", description: "오늘 점심 메뉴를 보여줘요." },
            { command: "/저녁", description: "오늘 저녁 메뉴를 보여줘요." },
            { command: "/조식 /중식 /석식", description: "같은 의미의 별칭으로도 조회할 수 있어요." }
        ]
    },
    {
        title: "날짜 지정",
        items: [
            { command: "/석식 오늘", description: "오늘 날짜를 명시해서 다시 조회해요." },
            { command: "/저녁 내일", description: "상대 날짜로 조회할 수 있어요." },
            { command: "/저녁 4/2", description: "월/일 형식으로 간단히 입력할 수 있어요." },
            { command: "/석식 2026-04-02", description: "연-월-일 형식도 지원해요." }
        ]
    },
    {
        title: "입력 예시",
        items: [
            { command: "/칠암 석식", description: "캠퍼스 이름을 같이 적어도 이해해요." },
            { command: "/학생식당 점심", description: "식당 이름을 같이 적어도 돼요." },
            { command: "/칠암캠퍼스 학생식당 저녁 4/2", description: "길게 적어도 핵심 키워드만 뽑아서 조회해요." }
        ]
    }
];

let cachedMenuData = null;
let cachedMenuDataAt = 0;

function padNumber(value) {
    return String(value).padStart(2, "0");
}

function toDateKey(date) {
    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function isValidDateParts(year, month, day) {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseDateToken(token, now = new Date()) {
    const normalized = String(token || "").trim();
    if (!normalized) return null;

    if (normalized === "오늘") return toDateKey(now);
    if (normalized === "내일") {
        const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return toDateKey(nextDate);
    }
    if (normalized === "어제") {
        const prevDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        return toDateKey(prevDate);
    }

    let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const [, yearRaw, monthRaw, dayRaw] = match;
        const year = Number(yearRaw);
        const month = Number(monthRaw);
        const day = Number(dayRaw);
        if (isValidDateParts(year, month, day)) {
            return `${yearRaw}-${monthRaw}-${dayRaw}`;
        }
        return null;
    }

    match = normalized.match(/^(\d{1,2})[./-](\d{1,2})$/);
    if (match) {
        const [, monthRaw, dayRaw] = match;
        const year = now.getFullYear();
        const month = Number(monthRaw);
        const day = Number(dayRaw);
        if (isValidDateParts(year, month, day)) {
            return `${year}-${padNumber(month)}-${padNumber(day)}`;
        }
        return null;
    }

    match = normalized.match(/^(\d{1,2})월(\d{1,2})일$/);
    if (match) {
        const [, monthRaw, dayRaw] = match;
        const year = now.getFullYear();
        const month = Number(monthRaw);
        const day = Number(dayRaw);
        if (isValidDateParts(year, month, day)) {
            return `${year}-${padNumber(month)}-${padNumber(day)}`;
        }
    }

    return null;
}

function normalizeCommandBody(value = "") {
    return String(value)
        .replace(/^\/+/, "")
        .replace(/칠암캠퍼스|칠암|학생\s*식당|학생식당/gi, " ")
        .trim();
}

function parseMealToken(token = "") {
    return mealAliasMap.get(String(token || "").trim()) || null;
}

function buildAvailableRangeLabel(menuData) {
    const availableDates = Object.keys(menuData?.menus || {}).sort();
    if (!availableDates.length) return "현재 캐시된 날짜가 없어요.";
    return `${availableDates[0]} ~ ${availableDates[availableDates.length - 1]}`;
}

function formatKoreanDate(dateKey) {
    const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateKey;

    const [, yearRaw, monthRaw, dayRaw] = match;
    const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    return `${yearRaw}.${monthRaw}.${dayRaw} (${weekday})`;
}

export function parseMealCommand(rawText, now = new Date()) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed.startsWith("/")) return null;

    const commandBody = normalizeCommandBody(trimmed);
    if (!commandBody) return null;

    const tokens = commandBody.split(/\s+/).filter(Boolean);
    let mealKey = null;
    let dateKey = null;

    for (const token of tokens) {
        if (!mealKey) {
            mealKey = parseMealToken(token);
            if (mealKey) continue;
        }

        if (!dateKey) {
            dateKey = parseDateToken(token, now);
        }
    }

    if (!mealKey) return null;

    return {
        mealKey,
        mealLabel: mealLabelMap[mealKey] || "식단",
        dateKey: dateKey || toDateKey(now),
        rawText: trimmed
    };
}

async function fetchMenuData(dataUrl = DEFAULT_MENU_DATA_URL) {
    const currentTime = Date.now();
    if (cachedMenuData && currentTime - cachedMenuDataAt < MENU_CACHE_TTL_MS) {
        return cachedMenuData;
    }

    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`menu-data-not-available:${response.status}`);
    }

    const data = await response.json();
    cachedMenuData = data;
    cachedMenuDataAt = currentTime;
    return data;
}

export async function resolveMealCommand(command, options = {}) {
    const dataUrl = options.dataUrl || DEFAULT_MENU_DATA_URL;
    const menuData = await fetchMenuData(dataUrl);
    const menuEntry = menuData?.menus?.[command.dateKey];
    const botName = menuData?.botName || DEFAULT_BOT_NAME;
    const location = menuData?.location || {};
    const campusLabel = location.campus || CAMPUS_LABEL;
    const restaurantLabel = location.restaurant || RESTAURANT_LABEL;

    if (!menuEntry) {
        return {
            ok: false,
            botName,
            text: `${command.dateKey} ${command.mealLabel} 데이터가 아직 없어요.\n현재 캐시 범위: ${buildAvailableRangeLabel(menuData)}`
        };
    }

    const items = Array.isArray(menuEntry[command.mealKey])
        ? menuEntry[command.mealKey].filter(Boolean)
        : [];

    if (!items.length) {
        return {
            ok: false,
            botName,
            text: `${command.dateKey} ${restaurantLabel} ${command.mealLabel} 메뉴가 아직 등록되지 않았어요.`
        };
    }

    return {
        ok: true,
        botName,
        payload: {
            type: "meal",
            text: `${campusLabel} ${restaurantLabel} ${command.mealLabel}`,
            cardTitle: `${campusLabel} ${restaurantLabel}`,
            cardSubtitle: `${formatKoreanDate(command.dateKey)} ${command.mealLabel}`,
            mealKey: command.mealKey,
            mealLabel: command.mealLabel,
            dateKey: command.dateKey,
            campusLabel,
            restaurantLabel,
            items,
            sourceUrl: menuEntry.sourceUrl || menuData?.sourceUrl || dataUrl,
            sourceLabel: "학교 식단 원본 보기"
        }
    };
}

export function getMealCommandHelpText() {
    return [
        "사용 가능한 식단 명령어",
        "/석식",
        "/석식 오늘",
        "/석식 2026-04-01",
        "/저녁 4/1"
    ].join("\n");
}

export function getCommandGuideSections() {
    return COMMAND_GUIDE_SECTIONS.map((section) => ({
        title: section.title,
        items: section.items.map((item) => ({ ...item }))
    }));
}
