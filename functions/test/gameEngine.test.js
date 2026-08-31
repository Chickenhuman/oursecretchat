"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getLastSyllable,
  getTurnDurationMs,
  nextPlayerUid,
  normalizeDictionaryHeadword,
  normalizeSettings,
  normalizeWord,
  validateWordShape,
} = require("../gameEngine");

test("단어를 NFC 한글 형태로 정규화한다", () => {
  assert.equal(normalizeWord("  기차표  "), "기차표");
  assert.equal(getLastSyllable("기차표"), "표");
  assert.equal(normalizeDictionaryHeadword("가사^도우미"), "가사도우미");
  assert.equal(normalizeDictionaryHeadword("기-차"), "기차");
});

test("기본 3글자 규칙과 이어지는 글자를 판정한다", () => {
  assert.deepEqual(validateWordShape({ word: "표고버", previousWord: "기차표", usedWords: [] }), {
    valid: true,
    word: "표고버",
    requiredSyllable: "표",
  });
  assert.equal(validateWordShape({ word: "자동차", previousWord: "기차표" }).code, "wrong_start");
  assert.equal(validateWordShape({ word: "표범", previousWord: "기차표" }).code, "wrong_length");
});

test("무제한 길이, 중복, 한글 외 문자를 판정한다", () => {
  assert.equal(validateWordShape({ word: "바다", wordLength: 0 }).valid, true);
  assert.equal(validateWordShape({ word: "바다", wordLength: 0, usedWords: ["바다"] }).code, "already_used");
  assert.equal(validateWordShape({ word: "KOREA", wordLength: 0 }).code, "invalid_chars");
});

test("설정은 서버 허용 범위로 제한된다", () => {
  assert.deepEqual(normalizeSettings({ wordLength: 0, baseTurnSeconds: 99, minTurnSeconds: 20 }), {
    wordLength: 0,
    baseTurnSeconds: 30,
    speedUpEnabled: true,
    speedUpEvery: 4,
    speedUpSeconds: 1,
    minTurnSeconds: 15,
  });
});

test("가속 규칙은 설정한 턴 묶음마다 적용되고 최솟값에서 멈춘다", () => {
  const settings = { baseTurnSeconds: 12, speedUpEvery: 4, speedUpSeconds: 2, minTurnSeconds: 5 };
  assert.equal(getTurnDurationMs(settings, 1), 12000);
  assert.equal(getTurnDurationMs(settings, 4), 12000);
  assert.equal(getTurnDurationMs(settings, 5), 10000);
  assert.equal(getTurnDurationMs(settings, 100), 5000);
});

test("두 플레이어 사이에서 다음 차례를 고른다", () => {
  const players = [{ uid: "a" }, { uid: "b" }];
  assert.equal(nextPlayerUid(players, "a"), "b");
  assert.equal(nextPlayerUid(players, "b"), "a");
  assert.equal(nextPlayerUid([{ uid: "a" }], "a"), null);
});

test("두 사람이 번갈아 단어를 잇는 한 판 흐름", () => {
  const players = [{ uid: "me" }, { uid: "partner" }];
  const settings = normalizeSettings({ wordLength: 3, baseTurnSeconds: 12, speedUpEvery: 2, speedUpSeconds: 1 });
  let turnUid = "me";
  const usedWords = [];

  for (const word of ["자동차", "차고지", "지우개", "개나리"]) {
    const result = validateWordShape({ word, previousWord: usedWords.at(-1), usedWords, wordLength: settings.wordLength });
    assert.equal(result.valid, true);
    usedWords.push(result.word);
    turnUid = nextPlayerUid(players, turnUid);
  }

  assert.deepEqual(usedWords, ["자동차", "차고지", "지우개", "개나리"]);
  assert.equal(turnUid, "me");
  assert.equal(getTurnDurationMs(settings, 1), 12000);
  assert.equal(getTurnDurationMs(settings, 3), 11000);
  assert.equal(validateWordShape({ word: "자동차", previousWord: "개나리", usedWords, wordLength: 3 }).code, "wrong_start");
  assert.equal(validateWordShape({ word: "자동차", previousWord: "", usedWords, wordLength: 3 }).code, "already_used");
});
