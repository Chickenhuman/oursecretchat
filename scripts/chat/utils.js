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
    if (data.type === "file") {
        return data.fileName ? `(파일) ${data.fileName}` : "파일을 보냈습니다.";
    }
    if (data.type === "meal") {
        return data.cardSubtitle
            ? `(식단) ${data.cardSubtitle}`
            : "(식단) 칠암캠퍼스 학생식당";
    }
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
