// 대화 검색용 로컬 색인 (IndexedDB)
// 처음 한 번 전체 대화를 받아 두고, 이후에는 마지막으로 받은 시점 이후 메시지만 추가로 받는다.
import { getMessagePreviewText } from "./utils.js";

const DB_NAME = "chat_search_index";
const DB_VERSION = 1;
const MESSAGE_STORE = "messages";
const META_STORE = "meta";
const PAGE_SIZE = 500;

function promisify(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(MESSAGE_STORE)) {
                database.createObjectStore(MESSAGE_STORE, { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains(META_STORE)) {
                database.createObjectStore(META_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function toEntry(docSnap) {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ts: data.timestamp ? data.timestamp.toMillis() : 0,
        sender: data.sender || "",
        senderUid: data.senderUid || "",
        type: data.type || "text",
        text: getMessagePreviewText(data)
    };
}

export function normalizeSearchText(value = "") {
    return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * @param {object} deps Firestore 인스턴스와 함수들 (index.html에서 이미 import한 것을 넘겨받음)
 */
export function createSearchIndex({ db, collection, query, orderBy, where, startAfter, limit, getDocs, getDoc, doc }) {
    let databasePromise = null;
    let memoryEntries = null; // 정렬된 캐시 (최신순)
    let syncPromise = null;

    const getDatabase = () => {
        if (!databasePromise) databasePromise = openDatabase();
        return databasePromise;
    };

    async function readAll() {
        const database = await getDatabase();
        const tx = database.transaction([MESSAGE_STORE, META_STORE], "readonly");
        const [entries, lastTs] = await Promise.all([
            promisify(tx.objectStore(MESSAGE_STORE).getAll()),
            promisify(tx.objectStore(META_STORE).get("lastTs"))
        ]);
        return { entries, lastTs: lastTs || 0 };
    }

    async function writeEntries(entries, lastTs) {
        const database = await getDatabase();
        const tx = database.transaction([MESSAGE_STORE, META_STORE], "readwrite");
        const store = tx.objectStore(MESSAGE_STORE);
        entries.forEach((entry) => store.put(entry));
        tx.objectStore(META_STORE).put(lastTs, "lastTs");
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function clear() {
        memoryEntries = null;
        try {
            const database = await getDatabase();
            const tx = database.transaction([MESSAGE_STORE, META_STORE], "readwrite");
            tx.objectStore(MESSAGE_STORE).clear();
            tx.objectStore(META_STORE).clear();
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.warn("검색 색인 초기화 실패:", error);
        }
    }

    async function runSync(onProgress) {
        let { entries, lastTs } = await readAll();

        // 대화 전체 삭제 등으로 서버 데이터가 사라졌으면 색인을 처음부터 다시 만든다.
        if (entries.length > 0) {
            const oldest = entries.reduce((a, b) => (a.ts <= b.ts ? a : b));
            const oldestSnap = await getDoc(doc(db, "chats", oldest.id));
            if (!oldestSnap.exists()) {
                await clear();
                entries = [];
                lastTs = 0;
            }
        }

        const byId = new Map(entries.map((entry) => [entry.id, entry]));
        let fetched = 0;
        let cursor = null;
        onProgress?.({ total: byId.size, fetched, done: false });

        while (true) {
            const constraints = [orderBy("timestamp", "asc")];
            // 밀리초 단위로 잘린 시각 때문에 누락되지 않도록 >= 로 받고 id로 중복 제거
            if (lastTs) constraints.unshift(where("timestamp", ">=", new Date(lastTs)));
            if (cursor) constraints.push(startAfter(cursor));
            constraints.push(limit(PAGE_SIZE));

            const snapshot = await getDocs(query(collection(db, "chats"), ...constraints));
            if (snapshot.empty) break;

            const batch = snapshot.docs.map(toEntry);
            batch.forEach((entry) => byId.set(entry.id, entry));
            const newestTs = batch.reduce((max, entry) => Math.max(max, entry.ts), lastTs);
            await writeEntries(batch, newestTs);

            fetched += batch.length;
            cursor = snapshot.docs[snapshot.docs.length - 1];
            onProgress?.({ total: byId.size, fetched, done: false });
            if (snapshot.docs.length < PAGE_SIZE) break;
        }

        memoryEntries = Array.from(byId.values()).sort((a, b) => b.ts - a.ts);
        onProgress?.({ total: memoryEntries.length, fetched, done: true });
        return memoryEntries;
    }

    function sync(onProgress) {
        if (!syncPromise) {
            syncPromise = runSync(onProgress).finally(() => { syncPromise = null; });
        }
        return syncPromise;
    }

    function search(rawQuery, maxResults = 200) {
        const q = normalizeSearchText(rawQuery);
        if (!q || !memoryEntries) return { results: [], total: 0 };
        const matches = memoryEntries.filter((entry) => normalizeSearchText(entry.text).includes(q));
        return { results: matches.slice(0, maxResults), total: matches.length };
    }

    async function remove(id) {
        if (memoryEntries) memoryEntries = memoryEntries.filter((entry) => entry.id !== id);
        try {
            const database = await getDatabase();
            database.transaction(MESSAGE_STORE, "readwrite").objectStore(MESSAGE_STORE).delete(id);
        } catch (error) {
            console.warn("검색 색인 항목 삭제 실패:", error);
        }
    }

    return { sync, search, clear, remove, get size() { return memoryEntries ? memoryEntries.length : 0; } };
}
