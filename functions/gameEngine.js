"use strict";

const DEFAULT_SETTINGS = Object.freeze({
  wordLength: 3,
  baseTurnSeconds: 12,
  speedUpEnabled: true,
  speedUpEvery: 4,
  speedUpSeconds: 1,
  minTurnSeconds: 5,
});

const FAILURE_MESSAGES = Object.freeze({
  empty: "단어를 입력하지 않았어요.",
  invalid_chars: "한글 음절로만 된 단어를 입력해야 해요.",
  wrong_length: "설정한 글자 수와 맞지 않아요.",
  wrong_start: "이전 단어의 마지막 글자로 시작하지 않아요.",
  already_used: "이미 나온 단어예요.",
  not_in_dictionary: "표준국어대사전에서 찾을 수 없는 단어예요.",
  timeout: "제한 시간 안에 단어를 내지 못했어요.",
});

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSettings(input = {}) {
  const rawLength = Number(input.wordLength);
  const wordLength = rawLength === 0 ? 0 : clampInteger(rawLength, 2, 4, DEFAULT_SETTINGS.wordLength);
  const baseTurnSeconds = clampInteger(input.baseTurnSeconds, 7, 30, DEFAULT_SETTINGS.baseTurnSeconds);
  const minTurnSeconds = Math.min(
    baseTurnSeconds,
    clampInteger(input.minTurnSeconds, 3, 15, DEFAULT_SETTINGS.minTurnSeconds),
  );

  return {
    wordLength,
    baseTurnSeconds,
    speedUpEnabled: input.speedUpEnabled !== false,
    speedUpEvery: clampInteger(input.speedUpEvery, 2, 10, DEFAULT_SETTINGS.speedUpEvery),
    speedUpSeconds: clampInteger(input.speedUpSeconds, 1, 5, DEFAULT_SETTINGS.speedUpSeconds),
    minTurnSeconds,
  };
}

function normalizeWord(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, "");
}

function normalizeDictionaryHeadword(value) {
  return normalizeWord(String(value || "").replace(/[\-^·]/g, ""));
}

function getLastSyllable(word) {
  const chars = Array.from(normalizeWord(word));
  return chars.at(-1) || "";
}

function validateWordShape({ word, previousWord = "", usedWords = [], wordLength = 3 }) {
  const normalized = normalizeWord(word);
  if (!normalized) return failure("empty", normalized);
  if (!/^[가-힣]+$/u.test(normalized)) return failure("invalid_chars", normalized);

  const length = Array.from(normalized).length;
  if (wordLength !== 0 && length !== wordLength) return failure("wrong_length", normalized);

  const required = getLastSyllable(previousWord);
  if (required && !normalized.startsWith(required)) return failure("wrong_start", normalized);

  const normalizedUsedWords = new Set(usedWords.map(normalizeWord));
  if (normalizedUsedWords.has(normalized)) return failure("already_used", normalized);

  return { valid: true, word: normalized, requiredSyllable: required };
}

function failure(code, word) {
  return { valid: false, code, word, message: FAILURE_MESSAGES[code] || "사용할 수 없는 단어예요." };
}

function getTurnDurationMs(settingsInput, turnNumber) {
  const settings = normalizeSettings(settingsInput);
  const safeTurnNumber = Math.max(1, Number(turnNumber) || 1);
  const completedGroups = settings.speedUpEnabled
    ? Math.floor((safeTurnNumber - 1) / settings.speedUpEvery)
    : 0;
  const seconds = Math.max(
    settings.minTurnSeconds,
    settings.baseTurnSeconds - completedGroups * settings.speedUpSeconds,
  );
  return seconds * 1000;
}

function nextPlayerUid(players, currentUid) {
  if (!Array.isArray(players) || players.length !== 2) return null;
  return players.find((player) => player.uid !== currentUid)?.uid || null;
}

module.exports = {
  DEFAULT_SETTINGS,
  FAILURE_MESSAGES,
  getLastSyllable,
  getTurnDurationMs,
  nextPlayerUid,
  normalizeDictionaryHeadword,
  normalizeSettings,
  normalizeWord,
  validateWordShape,
};
