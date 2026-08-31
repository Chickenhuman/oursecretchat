"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const {
  DEFAULT_SETTINGS,
  FAILURE_MESSAGES,
  getLastSyllable,
  getTurnDurationMs,
  nextPlayerUid,
  normalizeDictionaryHeadword,
  normalizeSettings,
  normalizeWord,
  validateWordShape,
} = require("./gameEngine");

initializeApp();

const db = getFirestore();
const STDICT_API_KEY = defineSecret("STDICT_API_KEY");
const REGION = "asia-northeast3";
const ROOM_COLLECTION = "kungkungtta_rooms";
const ROOM_ID = "couple";
const WORD_CACHE_COLLECTION = "korean_word_cache";
const MAX_WORDS_PER_ROUND = 250;
const VALID_CACHE_MS = 180 * 24 * 60 * 60 * 1000;
const INVALID_CACHE_MS = 14 * 24 * 60 * 60 * 1000;
const callableOptions = {
  region: REGION,
  // GitHub Pages의 게임 화면과 로컬 개발 환경에서만 Callable API를 호출할 수 있게 한다.
  cors: [
    "https://chickenhuman.github.io",
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ],
  maxInstances: 5,
  timeoutSeconds: 15,
};
const dictionaryCallableOptions = {
  ...callableOptions,
  secrets: [STDICT_API_KEY],
};

function gameError(code, message) {
  return new HttpsError(code, message, { userMessage: message });
}

function nowFields(now = Date.now()) {
  return { serverNowMs: now, updatedAt: FieldValue.serverTimestamp() };
}

function sanitizeName(value) {
  const name = String(value || "플레이어").trim().replace(/\s+/g, " ").slice(0, 24);
  return name || "플레이어";
}

async function requireApprovedUser(request) {
  if (!request.auth?.uid) {
    throw gameError("unauthenticated", "채팅방에서 Google 로그인을 먼저 해주세요.");
  }

  const email = String(request.auth.token?.email || "").trim().toLowerCase();
  if (!email || request.auth.token?.email_verified !== true) {
    throw gameError("permission-denied", "이메일 인증이 완료된 계정만 참여할 수 있어요.");
  }

  const approved = await db.collection("approved_emails").doc(email).get();
  if (!approved.exists) {
    throw gameError("permission-denied", "이 채팅방에 승인된 계정만 참여할 수 있어요.");
  }

  const profile = await db.collection("profiles").doc(request.auth.uid).get();
  const profileData = profile.exists ? profile.data() : {};
  const requestedName = request.data?.displayName;
  return {
    uid: request.auth.uid,
    name: sanitizeName(profileData?.chatAlias || requestedName || request.auth.token?.name),
  };
}

function newRoom(player, now) {
  return {
    version: 1,
    status: "waiting",
    hostUid: player.uid,
    players: [{ ...player, joinedAtMs: now }],
    settings: { ...DEFAULT_SETTINGS },
    usedWords: [],
    lastWord: "",
    requiredSyllable: "",
    turnUid: null,
    turnNumber: 0,
    turnSequence: 0,
    turnDurationMs: 0,
    turnDeadlineMs: null,
    starterIndex: 0,
    roundNumber: 0,
    winnerUid: null,
    loserUid: null,
    endReason: null,
    failureWord: "",
    lastResult: null,
    createdAt: FieldValue.serverTimestamp(),
    ...nowFields(now),
  };
}

function assertParticipant(room, uid) {
  if (!Array.isArray(room.players) || !room.players.some((player) => player.uid === uid)) {
    throw gameError("permission-denied", "이 게임방의 참가자가 아니에요.");
  }
}

function playerName(room, uid) {
  return room.players?.find((player) => player.uid === uid)?.name || "플레이어";
}

exports.joinKungKungTta = onCall(callableOptions, async (request) => {
  const player = await requireApprovedUser(request);
  const roomRef = db.collection(ROOM_COLLECTION).doc(ROOM_ID);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) {
      transaction.set(roomRef, newRoom(player, now));
      return;
    }

    const room = snapshot.data();
    const players = Array.isArray(room.players) ? [...room.players] : [];
    const existingIndex = players.findIndex((item) => item.uid === player.uid);

    if (existingIndex >= 0) {
      players[existingIndex] = { ...players[existingIndex], name: player.name, lastJoinedAtMs: now };
    } else {
      if (players.length >= 2) throw gameError("resource-exhausted", "두 명이 모두 입장한 게임방이에요.");
      players.push({ ...player, joinedAtMs: now });
    }

    transaction.update(roomRef, {
      players,
      hostUid: room.hostUid || players[0].uid,
      ...nowFields(now),
    });
  });

  return { ok: true, roomId: ROOM_ID, serverNowMs: now };
});

exports.startKungKungTta = onCall(callableOptions, async (request) => {
  const player = await requireApprovedUser(request);
  const roomRef = db.collection(ROOM_COLLECTION).doc(ROOM_ID);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) throw gameError("not-found", "게임방이 아직 없어요. 먼저 참가해주세요.");
    const room = snapshot.data();
    assertParticipant(room, player.uid);
    if (room.status === "playing") throw gameError("already-exists", "이미 게임이 진행 중이에요.");
    if (!Array.isArray(room.players) || room.players.length !== 2) {
      throw gameError("failed-precondition", "두 명이 모두 입장해야 시작할 수 있어요.");
    }
    if (room.status === "waiting" && room.hostUid !== player.uid) {
      throw gameError("permission-denied", "첫 번째 참가자가 게임을 시작할 수 있어요.");
    }

    const settings = room.hostUid === player.uid
      ? normalizeSettings(request.data?.settings || room.settings)
      : normalizeSettings(room.settings);
    const previousStarter = Number(room.starterIndex) === 1 ? 1 : 0;
    const starterIndex = room.status === "ended" ? (previousStarter + 1) % 2 : previousStarter;
    const turnUid = room.players[starterIndex].uid;
    const turnDurationMs = getTurnDurationMs(settings, 1);

    transaction.update(roomRef, {
      status: "playing",
      settings,
      usedWords: [],
      lastWord: "",
      requiredSyllable: "",
      turnUid,
      turnNumber: 1,
      turnSequence: (Number(room.turnSequence) || 0) + 1,
      turnDurationMs,
      turnDeadlineMs: now + turnDurationMs,
      starterIndex,
      roundNumber: (Number(room.roundNumber) || 0) + 1,
      winnerUid: null,
      loserUid: null,
      endReason: null,
      failureWord: "",
      pendingSubmission: FieldValue.delete(),
      lastResult: {
        kind: "start",
        message: `${playerName(room, turnUid)}님부터 시작해요!`,
        atMs: now,
      },
      ...nowFields(now),
    });
  });

  return { ok: true, serverNowMs: now };
});

async function validateDictionaryWord(word) {
  const cacheRef = db.collection(WORD_CACHE_COLLECTION).doc(word);
  const cacheSnapshot = await cacheRef.get();
  const now = Date.now();
  if (cacheSnapshot.exists) {
    const cache = cacheSnapshot.data();
    if (Number(cache.expiresAtMs) > now && typeof cache.valid === "boolean") {
      return { valid: cache.valid, source: "cache" };
    }
  }

  const apiKey = String(STDICT_API_KEY.value() || "").trim();
  if (!apiKey) {
    throw gameError("failed-precondition", "표준국어대사전 API 키가 아직 서버에 설정되지 않았어요.");
  }

  const url = new URL("https://stdict.korean.go.kr/api/search.do");
  url.search = new URLSearchParams({
    key: apiKey,
    q: word,
    req_type: "json",
    advanced: "y",
    target: "1",
    method: "exact",
    type1: "word",
    num: "10",
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  let payload;
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`dictionary http ${response.status}`);
    payload = await response.json();
  } catch (error) {
    console.error("Standard Korean Dictionary request failed", error);
    throw gameError("unavailable", "사전 확인이 잠시 지연되고 있어요. 같은 단어로 다시 시도해주세요.");
  } finally {
    clearTimeout(timeout);
  }

  if (payload?.error) {
    console.error("Standard Korean Dictionary API error", payload.error);
    throw gameError("unavailable", "사전 서버 응답을 확인할 수 없어요. 잠시 후 다시 시도해주세요.");
  }

  const rawItems = payload?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const valid = items.some((item) => normalizeDictionaryHeadword(item?.word) === word);
  await cacheRef.set({
    word,
    valid,
    source: "stdict.korean.go.kr",
    checkedAt: FieldValue.serverTimestamp(),
    checkedAtMs: now,
    expiresAtMs: now + (valid ? VALID_CACHE_MS : INVALID_CACHE_MS),
  });
  return { valid, source: "stdict" };
}

async function endRoundForFailure({ roomRef, uid, expectedSequence, failure, word = "" }) {
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) throw gameError("not-found", "게임방을 찾을 수 없어요.");
    const room = snapshot.data();
    assertParticipant(room, uid);
    if (room.status !== "playing" || room.turnUid !== uid || Number(room.turnSequence) !== expectedSequence) {
      throw gameError("aborted", "이미 다음 게임 상태로 넘어갔어요.");
    }
    const winnerUid = nextPlayerUid(room.players, uid);
    transaction.update(roomRef, {
      status: "ended",
      winnerUid,
      loserUid: uid,
      endReason: failure.code,
      failureWord: word,
      turnUid: null,
      turnDeadlineMs: null,
      turnSequence: expectedSequence + 1,
      pendingSubmission: FieldValue.delete(),
      lastResult: {
        kind: "failure",
        code: failure.code,
        message: failure.message,
        uid,
        word,
        atMs: now,
      },
      ...nowFields(now),
    });
  });
  return { accepted: false, failed: true, code: failure.code, message: failure.message, serverNowMs: now };
}

async function markPendingSubmission({ roomRef, uid, word, expectedSequence, receivedAtMs }) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) throw gameError("not-found", "게임방을 찾을 수 없어요.");
    const room = snapshot.data();
    assertParticipant(room, uid);
    if (room.status !== "playing" || room.turnUid !== uid || Number(room.turnSequence) !== expectedSequence) {
      throw gameError("aborted", "이미 다음 게임 상태로 넘어갔어요.");
    }
    if (receivedAtMs > Number(room.turnDeadlineMs || 0)) {
      throw gameError("deadline-exceeded", "제한 시간이 끝난 뒤 도착한 단어예요.");
    }
    transaction.update(roomRef, {
      pendingSubmission: {
        uid,
        word,
        turnSequence: expectedSequence,
        receivedAtMs,
        expiresAtMs: Date.now() + 8_000,
      },
      ...nowFields(Date.now()),
    });
  });
}

async function clearPendingSubmission(roomRef, uid, expectedSequence, restoreTurn = false) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) return;
    const room = snapshot.data();
    const pending = room.pendingSubmission;
    if (pending?.uid === uid && Number(pending.turnSequence) === expectedSequence) {
      const now = Date.now();
      const updates = { pendingSubmission: FieldValue.delete(), ...nowFields(now) };
      if (restoreTurn && room.status === "playing" && room.turnUid === uid) {
        updates.turnDeadlineMs = now + Math.max(3_000, Number(room.turnDurationMs) || 0);
      }
      transaction.update(roomRef, updates);
    }
  });
}

exports.submitKungKungTtaWord = onCall(dictionaryCallableOptions, async (request) => {
  const player = await requireApprovedUser(request);
  const roomRef = db.collection(ROOM_COLLECTION).doc(ROOM_ID);
  const receivedAtMs = Date.now();
  const snapshot = await roomRef.get();
  if (!snapshot.exists) throw gameError("not-found", "게임방을 찾을 수 없어요.");
  const room = snapshot.data();
  assertParticipant(room, player.uid);
  if (room.status !== "playing") throw gameError("failed-precondition", "진행 중인 게임이 아니에요.");
  if (room.turnUid !== player.uid) throw gameError("permission-denied", "지금은 상대방 차례예요.");
  if (receivedAtMs > Number(room.turnDeadlineMs || 0)) {
    return endRoundForFailure({
      roomRef,
      uid: player.uid,
      expectedSequence: Number(room.turnSequence),
      failure: { code: "timeout", message: FAILURE_MESSAGES.timeout },
    });
  }

  const shape = validateWordShape({
    word: request.data?.word,
    previousWord: room.lastWord,
    usedWords: room.usedWords,
    wordLength: normalizeSettings(room.settings).wordLength,
  });
  if (!shape.valid) {
    return endRoundForFailure({
      roomRef,
      uid: player.uid,
      expectedSequence: Number(room.turnSequence),
      failure: shape,
      word: shape.word,
    });
  }

  const expectedSequence = Number(room.turnSequence);
  await markPendingSubmission({
    roomRef,
    uid: player.uid,
    word: shape.word,
    expectedSequence,
    receivedAtMs,
  });

  let dictionary;
  try {
    dictionary = await validateDictionaryWord(shape.word);
  } catch (error) {
    // 사전 서비스 장애 때문에 플레이어가 시간 초과로 패배하지 않도록 해당 턴을 다시 준다.
    await clearPendingSubmission(roomRef, player.uid, expectedSequence, true).catch(() => {});
    throw error;
  }
  if (!dictionary.valid) {
    return endRoundForFailure({
      roomRef,
      uid: player.uid,
      expectedSequence,
      failure: { code: "not_in_dictionary", message: FAILURE_MESSAGES.not_in_dictionary },
      word: shape.word,
    });
  }

  let result;
  await db.runTransaction(async (transaction) => {
    const latestSnapshot = await transaction.get(roomRef);
    if (!latestSnapshot.exists) throw gameError("not-found", "게임방을 찾을 수 없어요.");
    const latest = latestSnapshot.data();
    assertParticipant(latest, player.uid);
    if (latest.status !== "playing" || latest.turnUid !== player.uid || Number(latest.turnSequence) !== expectedSequence) {
      throw gameError("aborted", "상대방 입력과 겹쳤어요. 최신 상태를 확인해주세요.");
    }

    const usedWords = [...(latest.usedWords || []), shape.word];
    const actionAtMs = Date.now();
    if (usedWords.length >= MAX_WORDS_PER_ROUND) {
      transaction.update(roomRef, {
        status: "ended",
        usedWords,
        lastWord: shape.word,
        requiredSyllable: getLastSyllable(shape.word),
        winnerUid: null,
        loserUid: null,
        endReason: "word_limit",
        turnUid: null,
        turnDeadlineMs: null,
        turnSequence: expectedSequence + 1,
        pendingSubmission: FieldValue.delete(),
        lastResult: { kind: "draw", message: "250개 단어를 이어 무승부로 끝났어요!", word: shape.word, uid: player.uid, atMs: actionAtMs },
        ...nowFields(actionAtMs),
      });
      result = { accepted: true, ended: true, serverNowMs: actionAtMs };
      return;
    }

    const nextUid = nextPlayerUid(latest.players, player.uid);
    const nextTurnNumber = (Number(latest.turnNumber) || 1) + 1;
    const turnDurationMs = getTurnDurationMs(latest.settings, nextTurnNumber);
    transaction.update(roomRef, {
      usedWords,
      lastWord: shape.word,
      requiredSyllable: getLastSyllable(shape.word),
      turnUid: nextUid,
      turnNumber: nextTurnNumber,
      turnSequence: expectedSequence + 1,
      turnDurationMs,
      turnDeadlineMs: actionAtMs + turnDurationMs,
      pendingSubmission: FieldValue.delete(),
      lastResult: {
        kind: "accepted",
        message: "좋아요! 다음 차례로 넘어갑니다.",
        uid: player.uid,
        word: shape.word,
        source: dictionary.source,
        atMs: actionAtMs,
      },
      ...nowFields(actionAtMs),
    });
    result = { accepted: true, nextUid, serverNowMs: actionAtMs };
  });

  return result;
});

exports.claimKungKungTtaTimeout = onCall(callableOptions, async (request) => {
  const player = await requireApprovedUser(request);
  const roomRef = db.collection(ROOM_COLLECTION).doc(ROOM_ID);
  const now = Date.now();
  let result = { timedOut: false, serverNowMs: now };

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) return;
    const room = snapshot.data();
    assertParticipant(room, player.uid);
    if (room.status !== "playing") return;
    const deadline = Number(room.turnDeadlineMs || 0);
    if (now < deadline) {
      result = { timedOut: false, remainingMs: deadline - now, serverNowMs: now };
      return;
    }

    const pending = room.pendingSubmission;
    if (
      pending?.uid === room.turnUid
      && Number(pending.turnSequence) === Number(room.turnSequence)
      && Number(pending.receivedAtMs) <= deadline
      && Number(pending.expiresAtMs) > now
    ) {
      result = {
        timedOut: false,
        checkingWord: true,
        retryAfterMs: Math.max(250, Number(pending.expiresAtMs) - now),
        serverNowMs: now,
      };
      return;
    }

    const loserUid = room.turnUid;
    const winnerUid = nextPlayerUid(room.players, loserUid);
    transaction.update(roomRef, {
      status: "ended",
      winnerUid,
      loserUid,
      endReason: "timeout",
      failureWord: "",
      turnUid: null,
      turnDeadlineMs: null,
      turnSequence: (Number(room.turnSequence) || 0) + 1,
      pendingSubmission: FieldValue.delete(),
      lastResult: {
        kind: "failure",
        code: "timeout",
        message: FAILURE_MESSAGES.timeout,
        uid: loserUid,
        word: "",
        atMs: now,
      },
      ...nowFields(now),
    });
    result = { timedOut: true, winnerUid, loserUid, serverNowMs: now };
  });

  return result;
});

exports.forfeitKungKungTta = onCall(callableOptions, async (request) => {
  const player = await requireApprovedUser(request);
  const roomRef = db.collection(ROOM_COLLECTION).doc(ROOM_ID);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists) throw gameError("not-found", "게임방을 찾을 수 없어요.");
    const room = snapshot.data();
    assertParticipant(room, player.uid);
    if (room.status !== "playing") throw gameError("failed-precondition", "진행 중인 게임이 아니에요.");
    const winnerUid = nextPlayerUid(room.players, player.uid);
    transaction.update(roomRef, {
      status: "ended",
      winnerUid,
      loserUid: player.uid,
      endReason: "forfeit",
      failureWord: "",
      turnUid: null,
      turnDeadlineMs: null,
      turnSequence: (Number(room.turnSequence) || 0) + 1,
      pendingSubmission: FieldValue.delete(),
      lastResult: { kind: "failure", code: "forfeit", message: "게임을 포기했어요.", uid: player.uid, word: "", atMs: now },
      ...nowFields(now),
    });
  });

  return { ok: true, serverNowMs: now };
});
