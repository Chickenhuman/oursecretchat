const URL_MATCH_REGEX = /https?:\/\/[^\s<>"']+/gi;

export const GIF_PROVIDER_ORDER = ["tenor", "giphy"];

const GIF_PROVIDER_LABELS = {
    tenor: "Tenor",
    giphy: "GIPHY"
};

function stripTrailingUrlPunctuation(value = "") {
    return String(value || "").replace(/[),.!?]+$/g, "");
}

function parsePositiveInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeAltText(value = "") {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function getLocaleInfo() {
    const rawLocale = typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";
    const [language = "en", region = "US"] = rawLocale.replace(/_/g, "-").split("-");
    return {
        rawLocale,
        language: language.toLowerCase(),
        region: String(region || "US").toUpperCase()
    };
}

function hasApiKey(value = "") {
    return String(value || "").trim().length > 0;
}

function buildTenorRequestUrl(pathname, params = {}) {
    const url = new URL(`https://tenor.googleapis.com${pathname}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        url.searchParams.set(key, String(value));
    });
    return url.toString();
}

function buildGiphyRequestUrl(pathname, params = {}) {
    const url = new URL(`https://api.giphy.com${pathname}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        url.searchParams.set(key, String(value));
    });
    return url.toString();
}

async function fetchJson(url) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json"
        }
    });
    if (!response.ok) {
        throw new Error(`gif/request-failed:${response.status}`);
    }
    return response.json();
}

function detectTenorGif(url) {
    if (!url.hostname.match(/(^|\.)tenor\.com$/i)) return null;
    const cleanPath = url.pathname.replace(/\/+$/g, "");
    const segments = cleanPath.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";
    const match = lastSegment.match(/-(\d+)$/);
    if (!match) return null;
    return {
        provider: "tenor",
        providerId: match[1]
    };
}

function detectGiphyGif(url) {
    if (!url.hostname.match(/(^|\.)giphy\.com$/i)) return null;
    const segments = url.pathname.replace(/\/+$/g, "").split("/").filter(Boolean);
    if (!segments.includes("gifs")) return null;
    const lastSegment = segments[segments.length - 1] || "";
    const candidateId = lastSegment.split("-").pop() || "";
    if (!/^[A-Za-z0-9]+$/.test(candidateId)) return null;
    return {
        provider: "giphy",
        providerId: candidateId
    };
}

function detectGifUrl(rawUrl = "") {
    try {
        const url = new URL(rawUrl);
        return detectTenorGif(url) || detectGiphyGif(url);
    } catch (error) {
        return null;
    }
}

function chooseFirstMedia(mediaFormats, keys) {
    if (!mediaFormats || typeof mediaFormats !== "object") return null;
    for (const key of keys) {
        const media = mediaFormats[key];
        if (media?.url) return media;
    }
    return null;
}

function normalizeTenorResult(result) {
    const mediaFormats = result?.media_formats;
    const sendMedia = chooseFirstMedia(mediaFormats, ["mediumgif", "tinygif", "gif", "nanogif"]);
    const previewMedia = chooseFirstMedia(mediaFormats, ["nanogif", "tinygif", "mediumgif", "gif"]) || sendMedia;
    if (!sendMedia?.url) return null;

    const dims = Array.isArray(sendMedia?.dims) && sendMedia.dims.length >= 2
        ? sendMedia.dims
        : Array.isArray(previewMedia?.dims) && previewMedia.dims.length >= 2
            ? previewMedia.dims
            : [];

    return {
        provider: "tenor",
        providerId: String(result?.id || ""),
        sourceUrl: String(result?.itemurl || result?.url || ""),
        gifUrl: String(sendMedia.url || ""),
        previewUrl: String(previewMedia?.url || sendMedia.url || ""),
        width: parsePositiveInt(dims[0]),
        height: parsePositiveInt(dims[1]),
        altText: normalizeAltText(result?.content_description || result?.title || result?.tags?.[0] || "")
    };
}

function normalizeGiphyResult(result) {
    const images = result?.images || {};
    const sendMedia = images.fixed_width || images.original || images.fixed_height || images.downsized || null;
    const previewMedia = images.fixed_width_small || images.fixed_width_downsampled || images.fixed_width_still || sendMedia;
    const gifUrl = sendMedia?.url || "";
    if (!gifUrl) return null;

    return {
        provider: "giphy",
        providerId: String(result?.id || ""),
        sourceUrl: String(result?.url || ""),
        gifUrl: String(gifUrl),
        previewUrl: String(previewMedia?.url || gifUrl),
        width: parsePositiveInt(sendMedia?.width) || parsePositiveInt(previewMedia?.width),
        height: parsePositiveInt(sendMedia?.height) || parsePositiveInt(previewMedia?.height),
        altText: normalizeAltText(result?.alt_text || result?.title || "")
    };
}

async function fetchTenorFeed({ query = "", limit = 24, tenorApiKey = "", tenorClientKey = "" }) {
    if (!hasApiKey(tenorApiKey)) {
        throw new Error("gif/provider-disabled");
    }
    const localeInfo = getLocaleInfo();
    const pathname = query ? "/v2/search" : "/v2/featured";
    const url = buildTenorRequestUrl(pathname, {
        key: tenorApiKey,
        client_key: tenorClientKey || "oursecretchat_web",
        q: query || undefined,
        limit,
        media_filter: "mediumgif,tinygif,nanogif",
        contentfilter: "medium",
        locale: `${localeInfo.language}_${localeInfo.region}`
    });
    const payload = await fetchJson(url);
    return Array.isArray(payload?.results)
        ? payload.results.map(normalizeTenorResult).filter(Boolean)
        : [];
}

async function fetchGiphyFeed({ query = "", limit = 24, giphyApiKey = "" }) {
    if (!hasApiKey(giphyApiKey)) {
        throw new Error("gif/provider-disabled");
    }
    const localeInfo = getLocaleInfo();
    const pathname = query ? "/v1/gifs/search" : "/v1/gifs/trending";
    const url = buildGiphyRequestUrl(pathname, {
        api_key: giphyApiKey,
        q: query || undefined,
        limit,
        rating: "pg",
        lang: localeInfo.language,
        country_code: localeInfo.region,
        bundle: "messaging_non_clips"
    });
    const payload = await fetchJson(url);
    return Array.isArray(payload?.data)
        ? payload.data.map(normalizeGiphyResult).filter(Boolean)
        : [];
}

async function fetchTenorPostById(providerId, { tenorApiKey = "", tenorClientKey = "" }) {
    if (!hasApiKey(tenorApiKey)) {
        throw new Error("gif/provider-disabled");
    }
    const localeInfo = getLocaleInfo();
    const url = buildTenorRequestUrl("/v2/posts", {
        key: tenorApiKey,
        client_key: tenorClientKey || "oursecretchat_web",
        ids: providerId,
        media_filter: "mediumgif,tinygif,nanogif",
        contentfilter: "medium",
        locale: `${localeInfo.language}_${localeInfo.region}`
    });
    const payload = await fetchJson(url);
    return normalizeTenorResult(Array.isArray(payload?.results) ? payload.results[0] : null);
}

async function fetchGiphyGifById(providerId, { giphyApiKey = "" }) {
    if (!hasApiKey(giphyApiKey)) {
        throw new Error("gif/provider-disabled");
    }
    const localeInfo = getLocaleInfo();
    const url = buildGiphyRequestUrl(`/v1/gifs/${providerId}`, {
        api_key: giphyApiKey,
        rating: "pg",
        country_code: localeInfo.region,
        bundle: "messaging_non_clips"
    });
    const payload = await fetchJson(url);
    return normalizeGiphyResult(payload?.data || null);
}

export function getGifProviderLabel(provider = "") {
    return GIF_PROVIDER_LABELS[provider] || provider;
}

export function getGifProviderAvailability({ tenorApiKey = "", giphyApiKey = "" } = {}) {
    return {
        tenor: hasApiKey(tenorApiKey),
        giphy: hasApiKey(giphyApiKey)
    };
}

export function getDefaultGifProvider(config = {}) {
    const availability = getGifProviderAvailability(config);
    return GIF_PROVIDER_ORDER.find((provider) => availability[provider]) || GIF_PROVIDER_ORDER[0];
}

export function extractGifUrlCandidates(text = "") {
    const source = String(text || "");
    const regex = new RegExp(URL_MATCH_REGEX);
    const candidates = [];
    let match;

    while ((match = regex.exec(source)) !== null) {
        const rawUrl = stripTrailingUrlPunctuation(match[0] || "");
        if (!rawUrl) continue;
        const detection = detectGifUrl(rawUrl);
        if (!detection) continue;

        candidates.push({
            url: rawUrl,
            provider: detection.provider,
            providerId: detection.providerId,
            start: match.index,
            end: match.index + rawUrl.length
        });
    }

    return candidates;
}

export async function fetchGifFeed(provider, options = {}, config = {}) {
    if (provider === "tenor") {
        return fetchTenorFeed({
            query: options.query || "",
            limit: options.limit || 24,
            tenorApiKey: config.tenorApiKey,
            tenorClientKey: config.tenorClientKey
        });
    }
    if (provider === "giphy") {
        return fetchGiphyFeed({
            query: options.query || "",
            limit: options.limit || 24,
            giphyApiKey: config.giphyApiKey
        });
    }
    throw new Error("gif/unknown-provider");
}

export async function resolveGifDescriptorFromUrl(rawUrl = "", config = {}) {
    const detected = detectGifUrl(rawUrl);
    if (!detected) {
        throw new Error("gif/unsupported-url");
    }

    const descriptor = detected.provider === "tenor"
        ? await fetchTenorPostById(detected.providerId, config)
        : await fetchGiphyGifById(detected.providerId, config);

    if (!descriptor) {
        throw new Error("gif/not-found");
    }

    return {
        ...descriptor,
        sourceUrl: descriptor.sourceUrl || rawUrl
    };
}
