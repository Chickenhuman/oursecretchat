export function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

export function escapeAttribute(value = "") {
    return escapeHtml(value).replace(/\n/g, "&#10;");
}

export function encodeInlineParam(value = "") {
    return encodeURIComponent(String(value));
}

export function decodeInlineParam(value = "") {
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return String(value);
    }
}

export function getMessagePreviewText(data) {
    if (data.type === "sticker") return "(이모티콘)";
    return data.text || "";
}

export function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return String(text || "").split(urlRegex).map((part) => {
        if (/^https?:\/\/[^\s]+$/.test(part)) {
            return `<a href="${escapeAttribute(part)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`;
        }
        return escapeHtml(part).replace(/\n/g, "<br>");
    }).join("");
}
