import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { firebaseConfig } from "../../scripts/chat/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");
const roomRef = doc(db, "kungkungtta_rooms", "couple");
const callables = {
  join: httpsCallable(functions, "joinKungKungTta"),
  start: httpsCallable(functions, "startKungKungTta"),
  submit: httpsCallable(functions, "submitKungKungTtaWord"),
  timeout: httpsCallable(functions, "claimKungKungTtaTimeout"),
  forfeit: httpsCallable(functions, "forfeitKungKungTta"),
};

const DEFAULT_SETTINGS = {
  wordLength: 3,
  baseTurnSeconds: 12,
  speedUpEnabled: true,
  speedUpEvery: 4,
  speedUpSeconds: 1,
  minTurnSeconds: 5,
};
const SETTINGS_KEY = "kkungkungtta_settings";
const PRESENCE_FRESH_MS = 70_000;

const elements = {
  loading: document.getElementById("loading"),
  loadingMessage: document.getElementById("loading-message"),
  appStatus: document.getElementById("app-status"),
  banner: document.getElementById("connection-banner"),
  settingsOpen: document.getElementById("settings-open"),
  settingsDialog: document.getElementById("settings-dialog"),
  settingsClose: document.getElementById("settings-close"),
  settingsForm: document.getElementById("settings-form"),
  speedUpEnabled: document.getElementById("speed-up-enabled"),
  speedUpFields: document.getElementById("speed-up-fields"),
  wordLength: document.getElementById("word-length"),
  baseTurnSeconds: document.getElementById("base-turn-seconds"),
  speedUpEvery: document.getElementById("speed-up-every"),
  speedUpSeconds: document.getElementById("speed-up-seconds"),
  minTurnSeconds: document.getElementById("min-turn-seconds"),
  roundChip: document.getElementById("round-chip"),
  timer: document.getElementById("timer"),
  timerValue: document.getElementById("timer-value"),
  timerFill: document.getElementById("timer-fill"),
  wordDisplay: document.getElementById("word-display"),
  turnMessage: document.getElementById("turn-message"),
  feedback: document.getElementById("feedback"),
  history: document.getElementById("word-history"),
  answerForm: document.getElementById("answer-form"),
  wordInput: document.getElementById("word-input"),
  submitButton: document.getElementById("submit-button"),
  controlTitle: document.getElementById("control-title"),
  controlCopy: document.getElementById("control-copy"),
  primaryAction: document.getElementById("primary-action"),
  forfeitButton: document.getElementById("forfeit-button"),
  loginAction: document.getElementById("login-action"),
};

let currentUser = null;
let currentRoom = null;
let presenceByUid = new Map();
let roomUnsubscribe = null;
let presenceUnsubscribe = null;
let presenceTimer = null;
let submitting = false;
let actionPending = false;
let timeoutSequenceClaimed = null;
let serverOffsetMs = 0;
let feedbackTimer = null;

function setLoading(message, visible = true) {
  elements.loadingMessage.textContent = message;
  elements.loading.hidden = !visible;
}

function setBanner(message = "") {
  elements.banner.textContent = message;
  elements.banner.hidden = !message;
}

function userMessage(error, fallback = "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.") {
  return error?.details?.userMessage || error?.message?.replace(/^FirebaseError:\s*/i, "") || fallback;
}

function showFeedback(message, isError = false, duration = 3200) {
  clearTimeout(feedbackTimer);
  elements.feedback.textContent = message;
  elements.feedback.classList.toggle("error", isError);
  elements.feedback.hidden = !message;
  if (message && duration > 0) {
    feedbackTimer = setTimeout(() => { elements.feedback.hidden = true; }, duration);
  }
}

function parseSettings(value) {
  return {
    wordLength: Number(value?.wordLength ?? DEFAULT_SETTINGS.wordLength),
    baseTurnSeconds: Number(value?.baseTurnSeconds ?? DEFAULT_SETTINGS.baseTurnSeconds),
    speedUpEnabled: value?.speedUpEnabled !== false,
    speedUpEvery: Number(value?.speedUpEvery ?? DEFAULT_SETTINGS.speedUpEvery),
    speedUpSeconds: Number(value?.speedUpSeconds ?? DEFAULT_SETTINGS.speedUpSeconds),
    minTurnSeconds: Number(value?.minTurnSeconds ?? DEFAULT_SETTINGS.minTurnSeconds),
  };
}

function readSavedSettings() {
  try { return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null")); }
  catch { return { ...DEFAULT_SETTINGS }; }
}

function readSettingsForm() {
  return parseSettings({
    wordLength: elements.wordLength.value,
    baseTurnSeconds: elements.baseTurnSeconds.value,
    speedUpEnabled: elements.speedUpEnabled.checked,
    speedUpEvery: elements.speedUpEvery.value,
    speedUpSeconds: elements.speedUpSeconds.value,
    minTurnSeconds: elements.minTurnSeconds.value,
  });
}

function fillSettingsForm(settingsInput) {
  const settings = parseSettings(settingsInput);
  elements.wordLength.value = String(settings.wordLength);
  elements.baseTurnSeconds.value = String(settings.baseTurnSeconds);
  elements.speedUpEnabled.checked = settings.speedUpEnabled;
  elements.speedUpEvery.value = String(settings.speedUpEvery);
  elements.speedUpSeconds.value = String(settings.speedUpSeconds);
  elements.minTurnSeconds.value = String(settings.minTurnSeconds);
  elements.speedUpFields.hidden = !settings.speedUpEnabled;
}

function formatRules(settingsInput) {
  const settings = parseSettings(settingsInput);
  const length = settings.wordLength === 0 ? "글자 수 자유" : `${settings.wordLength}글자`;
  const speed = settings.speedUpEnabled ? ` · ${settings.speedUpEvery}턴마다 ${settings.speedUpSeconds}초 단축` : " · 고정 시간";
  return `${length} · ${settings.baseTurnSeconds}초${speed}`;
}

function toMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  return Number(value || 0);
}

function playerFor(uid) {
  return currentRoom?.players?.find((player) => player.uid === uid) || null;
}

function isOnline(uid) {
  if (!uid) return false;
  if (uid === currentUser?.uid && document.visibilityState === "visible") return true;
  return Date.now() - toMillis(presenceByUid.get(uid)?.lastSeen) < PRESENCE_FRESH_MS;
}

function renderPlayers() {
  const players = currentRoom?.players || [];
  for (let index = 0; index < 2; index += 1) {
    const player = players[index];
    const card = document.getElementById(`player-card-${index}`);
    const name = document.getElementById(`player-name-${index}`);
    const state = document.getElementById(`player-state-${index}`);
    const active = currentRoom?.status === "playing" && currentRoom.turnUid === player?.uid;
    const online = isOnline(player?.uid);
    card.classList.toggle("active", active);
    card.classList.toggle("me", player?.uid === currentUser?.uid);
    card.classList.toggle("online", Boolean(player && online));
    name.textContent = player?.name || "입장 대기";
    if (!player) state.textContent = "비어 있음";
    else if (active) state.textContent = player.uid === currentUser?.uid ? "지금 내 차례" : "단어 생각 중";
    else state.textContent = online ? "접속 중" : "자리 등록됨";
  }
}

function setWordDisplay(word, highlightLast = false) {
  elements.wordDisplay.textContent = "";
  elements.wordDisplay.classList.toggle("placeholder", !word);
  if (!word) {
    elements.wordDisplay.textContent = "쿵쿵따";
    return;
  }
  const chars = Array.from(word);
  chars.forEach((char, index) => {
    const span = document.createElement("span");
    span.textContent = char;
    if (highlightLast && index === chars.length - 1) span.className = "next";
    elements.wordDisplay.appendChild(span);
  });
}

function renderHistory(words = []) {
  elements.history.textContent = "";
  words.forEach((word) => {
    const chip = document.createElement("span");
    chip.textContent = word;
    elements.history.appendChild(chip);
  });
  requestAnimationFrame(() => { elements.history.scrollLeft = elements.history.scrollWidth; });
}

function setInputEnabled(enabled) {
  const active = enabled && !submitting && !actionPending;
  elements.wordInput.disabled = !active;
  elements.submitButton.disabled = !active;
  elements.submitButton.textContent = submitting ? "판정 중" : "외치기";
  if (active && document.visibilityState === "visible") {
    requestAnimationFrame(() => elements.wordInput.focus({ preventScroll: true }));
  }
}

function configurePrimary({ label, enabled = true, visible = true }) {
  elements.primaryAction.textContent = label;
  elements.primaryAction.disabled = !enabled || actionPending;
  elements.primaryAction.hidden = !visible;
}

function failureLabel(reason) {
  return {
    timeout: "시간 초과",
    empty: "빈 단어",
    invalid_chars: "한글이 아닌 입력",
    wrong_length: "글자 수 오류",
    wrong_start: "이어지지 않은 단어",
    already_used: "중복 단어",
    not_in_dictionary: "사전에 없는 단어",
    forfeit: "포기",
    word_limit: "250단어 달성",
  }[reason] || "규칙 위반";
}

function renderWaiting(room) {
  const players = room.players || [];
  elements.roundChip.textContent = "게임 준비";
  elements.timer.classList.remove("running");
  elements.timerValue.textContent = "--";
  elements.timerFill.style.width = "0%";
  setWordDisplay("");
  renderHistory([]);
  setInputEnabled(false);
  elements.forfeitButton.hidden = true;
  elements.loginAction.hidden = true;

  if (players.length < 2) {
    elements.turnMessage.textContent = "상대방이 게임 탭에 들어오면 함께 시작할 수 있어요.";
    elements.controlTitle.textContent = "상대방을 기다리는 중";
    elements.controlCopy.textContent = "두 사람의 자리는 한 번 등록되면 유지돼요. 상대방도 게임 탭을 열어주세요.";
    configurePrimary({ label: `${players.length}/2 입장`, enabled: false });
  } else if (room.hostUid === currentUser?.uid) {
    elements.turnMessage.textContent = "둘 다 입장했어요. 준비되면 시작하세요!";
    elements.controlTitle.textContent = "둘 다 준비 완료";
    elements.controlCopy.textContent = "준비되면 시작하세요.";
    configurePrimary({ label: "게임 시작", enabled: true });
  } else {
    elements.turnMessage.textContent = "방장이 게임을 시작하면 첫 차례가 표시돼요.";
    elements.controlTitle.textContent = "방장의 시작을 기다리는 중";
    elements.controlCopy.textContent = "시작 신호를 기다려주세요.";
    configurePrimary({ label: "시작 대기 중", enabled: false });
  }
}

function renderPlaying(room) {
  const myTurn = room.turnUid === currentUser?.uid;
  const turnPlayer = playerFor(room.turnUid);
  elements.roundChip.textContent = `${room.roundNumber || 1}번째 판 · ${room.turnNumber || 1}턴`;
  elements.timer.classList.add("running");
  setWordDisplay(room.lastWord || "", Boolean(room.lastWord));
  renderHistory(room.usedWords || []);
  elements.turnMessage.textContent = myTurn ? "내 차례" : `${turnPlayer?.name || "상대방"}님 차례`;
  setInputEnabled(myTurn);
  elements.controlTitle.textContent = "실시간 게임 진행 중";
  elements.controlCopy.textContent = "";
  configurePrimary({ label: "진행 중", visible: false });
  elements.loginAction.hidden = true;
  elements.forfeitButton.hidden = false;
  elements.forfeitButton.disabled = actionPending;
}

function renderEnded(room) {
  const winner = playerFor(room.winnerUid);
  const loser = playerFor(room.loserUid);
  const isDraw = !room.winnerUid;
  const iWon = room.winnerUid === currentUser?.uid;
  elements.roundChip.textContent = `${room.roundNumber || 1}번째 판 종료 · ${failureLabel(room.endReason)}`;
  elements.timer.classList.remove("running");
  elements.timerValue.textContent = "끝";
  elements.timerFill.style.width = "0%";
  setWordDisplay(room.failureWord || room.lastWord || "", false);
  renderHistory(room.usedWords || []);
  setInputEnabled(false);
  elements.turnMessage.textContent = isDraw ? "정말 길게 이어간 멋진 무승부예요!" : iWon ? "이번 판 승리! 🎉" : `${winner?.name || "상대방"}님이 이번 판을 이겼어요.`;
  elements.controlTitle.textContent = isDraw ? "무승부" : `${winner?.name || "플레이어"} 승리`;
  elements.controlCopy.textContent = room.lastResult?.message || (loser ? `${loser.name}님의 ${failureLabel(room.endReason)}로 끝났어요.` : "이번 판이 끝났어요.");
  configurePrimary({ label: "한 판 더", enabled: true });
  elements.forfeitButton.hidden = true;
  elements.loginAction.hidden = true;
}

function renderRoom() {
  if (!currentRoom || !currentUser) return;
  const settings = parseSettings(currentRoom.settings);
  elements.appStatus.textContent = formatRules(settings);
  elements.wordInput.placeholder = settings.wordLength === 0 ? "한국어 단어" : `${settings.wordLength}글자 단어`;
  timeoutSequenceClaimed = timeoutSequenceClaimed === currentRoom.turnSequence ? timeoutSequenceClaimed : null;
  renderPlayers();
  if (currentRoom.status === "playing") renderPlaying(currentRoom);
  else if (currentRoom.status === "ended") renderEnded(currentRoom);
  else renderWaiting(currentRoom);
}

function renderLoggedOut() {
  currentRoom = null;
  elements.appStatus.textContent = "로그인 필요";
  elements.controlTitle.textContent = "채팅방 로그인이 필요해요";
  elements.controlCopy.textContent = "두 사람만 쓰는 게임방이라 채팅방에서 승인된 Google 계정으로 먼저 로그인해주세요.";
  elements.primaryAction.hidden = true;
  elements.forfeitButton.hidden = true;
  elements.loginAction.hidden = false;
  elements.settingsOpen.disabled = true;
  elements.turnMessage.textContent = "채팅방에서 로그인한 뒤 다시 열어주세요.";
  setInputEnabled(false);
  setLoading("", false);
}

async function touchPresence() {
  if (!currentUser || document.visibilityState !== "visible") return;
  try {
    await setDoc(doc(db, "presence", currentUser.uid), {
      name: localStorage.getItem("chat_nickname") || currentUser.displayName || "플레이어",
      lastSeen: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn("presence update failed", error);
  }
}

function startPresence() {
  clearInterval(presenceTimer);
  void touchPresence();
  presenceTimer = setInterval(touchPresence, 30_000);
  presenceUnsubscribe?.();
  presenceUnsubscribe = onSnapshot(collection(db, "presence"), (snapshot) => {
    presenceByUid = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    renderPlayers();
  }, () => {});
}

function listenToRoom() {
  roomUnsubscribe?.();
  roomUnsubscribe = onSnapshot(roomRef, { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.exists()) return;
    currentRoom = snapshot.data();
    if (Number(currentRoom.serverNowMs)) serverOffsetMs = Number(currentRoom.serverNowMs) - Date.now();
    setBanner(snapshot.metadata.fromCache && !navigator.onLine ? "인터넷 연결을 기다리고 있어요. 연결되면 최신 게임 상태로 맞춰집니다." : "");
    renderRoom();
    setLoading("", false);
  }, (error) => {
    console.error("room listener failed", error);
    setBanner("게임 상태를 불러오지 못했어요. 새로고침하거나 채팅방 로그인을 확인해주세요.");
    setLoading("", false);
  });
}

async function joinRoom() {
  setLoading("둘만의 게임방에 입장하는 중...");
  const displayName = localStorage.getItem("chat_nickname") || currentUser.displayName || "플레이어";
  await callables.join({ displayName });
  listenToRoom();
  startPresence();
}

async function startRound() {
  if (!currentRoom || actionPending) return;
  actionPending = true;
  renderRoom();
  const label = currentRoom.status === "ended" ? "새 판 준비 중" : "게임 시작 중";
  elements.primaryAction.textContent = label;
  try {
    const settings = currentRoom.hostUid === currentUser?.uid ? readSavedSettings() : parseSettings(currentRoom.settings);
    await callables.start({ settings });
    showFeedback("새 판을 시작합니다!", false, 1800);
  } catch (error) {
    showFeedback(userMessage(error), true, 4200);
  } finally {
    actionPending = false;
    renderRoom();
  }
}

async function submitWord(event) {
  event.preventDefault();
  if (!currentRoom || currentRoom.status !== "playing" || currentRoom.turnUid !== currentUser?.uid || submitting) return;
  const word = elements.wordInput.value;
  submitting = true;
  elements.wordInput.value = "";
  setInputEnabled(false);
  try {
    const response = await callables.submit({ word });
    if (response.data?.accepted) showFeedback("좋아요! 인정된 단어예요.", false, 1800);
    else if (response.data?.failed) showFeedback(response.data.message || "사용할 수 없는 단어예요.", true, 5000);
  } catch (error) {
    showFeedback(userMessage(error), true, 5000);
    elements.wordInput.value = word;
  } finally {
    submitting = false;
    renderRoom();
  }
}

async function claimTimeout() {
  if (!currentRoom || currentRoom.status !== "playing") return;
  const sequence = currentRoom.turnSequence;
  if (timeoutSequenceClaimed === sequence) return;
  timeoutSequenceClaimed = sequence;
  try {
    const response = await callables.timeout({ turnSequence: sequence });
    if (!response.data?.timedOut && currentRoom?.turnSequence === sequence) {
      if (Number(response.data?.serverNowMs)) serverOffsetMs = Number(response.data.serverNowMs) - Date.now();
      const retryAfterMs = Math.max(250, Number(response.data?.retryAfterMs || response.data?.remainingMs || 500));
      setTimeout(() => {
        if (currentRoom?.turnSequence === sequence) timeoutSequenceClaimed = null;
      }, retryAfterMs);
    }
  } catch (error) {
    console.warn("timeout claim failed", error);
    if (currentRoom?.turnSequence === sequence) setTimeout(() => { timeoutSequenceClaimed = null; }, 800);
  }
}

async function forfeitRound() {
  if (!currentRoom || currentRoom.status !== "playing" || actionPending) return;
  if (!window.confirm("이번 판을 포기할까요? 상대방의 승리로 끝납니다.")) return;
  actionPending = true;
  renderRoom();
  try { await callables.forfeit({}); }
  catch (error) { showFeedback(userMessage(error), true, 4500); }
  finally { actionPending = false; renderRoom(); }
}

function timerLoop() {
  if (currentRoom?.status === "playing") {
    const deadline = Number(currentRoom.turnDeadlineMs || 0);
    const duration = Math.max(1, Number(currentRoom.turnDurationMs || 1));
    const remaining = Math.max(0, deadline - (Date.now() + serverOffsetMs));
    const ratio = Math.min(1, remaining / duration);
    elements.timerValue.textContent = (remaining / 1000).toFixed(1);
    elements.timerFill.style.width = `${ratio * 100}%`;
    elements.timerFill.classList.toggle("urgent", remaining <= 3000);
    if (remaining <= 0) void claimTimeout();
  } else {
    elements.timerFill.classList.remove("urgent");
  }
  requestAnimationFrame(timerLoop);
}

elements.answerForm.addEventListener("submit", submitWord);
elements.wordInput.addEventListener("keydown", (event) => { if (event.isComposing && event.key === "Enter") event.preventDefault(); });
elements.primaryAction.addEventListener("click", startRound);
elements.forfeitButton.addEventListener("click", forfeitRound);
elements.settingsOpen.addEventListener("click", () => {
  const canEdit = currentRoom?.hostUid === currentUser?.uid && currentRoom?.status !== "playing";
  const source = canEdit ? readSavedSettings() : parseSettings(currentRoom?.settings);
  fillSettingsForm(source);
  elements.settingsForm.querySelectorAll("select,input").forEach((control) => { control.disabled = !canEdit; });
  const saveButton = elements.settingsForm.querySelector('button[type="submit"]');
  saveButton.textContent = canEdit ? "설정 저장" : "확인";
  elements.settingsDialog.showModal();
});
elements.settingsClose.addEventListener("click", () => elements.settingsDialog.close());
elements.speedUpEnabled.addEventListener("change", () => { elements.speedUpFields.hidden = !elements.speedUpEnabled.checked; });
elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (currentRoom?.hostUid === currentUser?.uid && currentRoom?.status !== "playing") {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(readSettingsForm()));
    showFeedback("다음 게임부터 적용해요.", false, 2200);
  }
  elements.settingsDialog.close();
});
elements.settingsDialog.addEventListener("click", (event) => {
  if (event.target === elements.settingsDialog) elements.settingsDialog.close();
});

window.addEventListener("online", () => { setBanner(""); void touchPresence(); });
window.addEventListener("offline", () => setBanner("인터넷 연결이 끊겼어요. 입력하지 말고 연결이 돌아올 때까지 기다려주세요."));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { void touchPresence(); renderRoom(); } });

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  elements.settingsOpen.disabled = !user;
  if (!user) {
    roomUnsubscribe?.();
    presenceUnsubscribe?.();
    clearInterval(presenceTimer);
    renderLoggedOut();
    return;
  }
  try { await joinRoom(); }
  catch (error) {
    console.error("game join failed", error);
    setLoading("", false);
    setBanner(userMessage(error, "게임방에 입장하지 못했어요. 채팅방 로그인을 확인해주세요."));
    elements.controlTitle.textContent = "게임방에 들어가지 못했어요";
    elements.controlCopy.textContent = userMessage(error);
    configurePrimary({ label: "다시 시도", enabled: true });
    elements.primaryAction.onclick = () => { elements.primaryAction.onclick = null; void joinRoom(); };
  }
});

fillSettingsForm(readSavedSettings());
requestAnimationFrame(timerLoop);
