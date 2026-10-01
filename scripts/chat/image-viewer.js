// 카카오톡 스타일 이미지 뷰어 (닫기 / 회전 / 저장 / 좌우 넘기기 / 확대)
const GROUP_SELECTORS = [
    { container: '#messages', item: '.chat-img' },
    { container: '#gallery-preview', item: '.gallery-item' },
    { container: '#full-gallery-grid', item: '.gallery-item' }
];

const ICONS = {
    close: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
};

const STYLE = `
#image-viewer { position: fixed; inset: 0; z-index: 10000; background: #000; display: none; flex-direction: column; color: #fff; user-select: none; -webkit-user-select: none; touch-action: none; }
#image-viewer.open { display: flex; }
#image-viewer .iv-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: rgba(0,0,0,0.55); position: absolute; left: 0; right: 0; z-index: 2; transition: opacity .2s; }
#image-viewer .iv-top { top: 0; padding-top: calc(10px + env(safe-area-inset-top, 0px)); }
#image-viewer .iv-bottom { bottom: 0; justify-content: center; gap: 48px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
#image-viewer.hide-ui .iv-bar, #image-viewer.hide-ui .iv-nav { opacity: 0; pointer-events: none; }
#image-viewer .iv-counter { font-size: 15px; opacity: .9; min-width: 60px; }
#image-viewer button { background: none; border: none; color: inherit; cursor: pointer; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; font-family: inherit; }
#image-viewer button:disabled { opacity: .35; cursor: default; }
#image-viewer .iv-stage { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
#image-viewer .iv-img { max-width: 100%; max-height: 100%; object-fit: contain; transform-origin: center center; will-change: transform; -webkit-user-drag: none; pointer-events: none; }
#image-viewer .iv-img.animate { transition: transform .25s ease; }
#image-viewer .iv-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; background: rgba(0,0,0,0.35); border-radius: 50%; width: 44px; height: 44px; justify-content: center; transition: opacity .2s; }
#image-viewer .iv-nav[hidden] { display: none; }
#image-viewer .iv-prev { left: 8px; }
#image-viewer .iv-next { right: 8px; }
#image-viewer .iv-toast { position: absolute; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); background: rgba(255,255,255,0.92); color: #222; font-size: 13px; padding: 8px 14px; border-radius: 16px; z-index: 3; white-space: nowrap; opacity: 0; transition: opacity .2s; pointer-events: none; }
#image-viewer .iv-toast.show { opacity: 1; }
@media (hover: none) { #image-viewer .iv-nav { display: none; } }
`;

const state = {
    items: [],
    index: 0,
    rotation: 0,
    zoom: 1,
    tx: 0,
    ty: 0,
    pushedHistory: false
};

let root, stage, img, counterEl, prevBtn, nextBtn, saveBtn, toastEl, toastTimer;

function buildViewer() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = 'image-viewer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
        <div class="iv-bar iv-top">
            <span class="iv-counter"></span>
            <button type="button" class="iv-close" aria-label="닫기">${ICONS.close}</button>
        </div>
        <div class="iv-stage">
            <img class="iv-img" alt="">
            <button type="button" class="iv-nav iv-prev" aria-label="이전 사진">${ICONS.prev}</button>
            <button type="button" class="iv-nav iv-next" aria-label="다음 사진">${ICONS.next}</button>
        </div>
        <div class="iv-bar iv-bottom">
            <button type="button" class="iv-rotate" aria-label="회전">${ICONS.rotate}<span>회전</span></button>
            <button type="button" class="iv-save" aria-label="저장">${ICONS.save}<span>저장</span></button>
        </div>
        <div class="iv-toast"></div>`;
    document.body.appendChild(root);

    stage = root.querySelector('.iv-stage');
    img = root.querySelector('.iv-img');
    counterEl = root.querySelector('.iv-counter');
    prevBtn = root.querySelector('.iv-prev');
    nextBtn = root.querySelector('.iv-next');
    saveBtn = root.querySelector('.iv-save');
    toastEl = root.querySelector('.iv-toast');

    root.querySelector('.iv-close').addEventListener('click', closeImageViewer);
    root.querySelector('.iv-rotate').addEventListener('click', rotate);
    saveBtn.addEventListener('click', saveCurrent);
    prevBtn.addEventListener('click', () => go(-1));
    nextBtn.addEventListener('click', () => go(1));
    img.addEventListener('load', () => applyTransform(false));
    img.addEventListener('error', () => showToast('이미지를 불러오지 못했어요.'));

    bindGestures();

    document.addEventListener('keydown', (e) => {
        if (!root.classList.contains('open')) return;
        if (e.key === 'Escape') closeImageViewer();
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'r' || e.key === 'R') rotate();
    });

    window.addEventListener('popstate', () => {
        if (!root.classList.contains('open')) return;
        state.pushedHistory = false;
        hideViewer();
    });
    window.addEventListener('resize', () => {
        if (root.classList.contains('open')) applyTransform(false);
    });
}

function collectGroup(sourceEl, url) {
    if (sourceEl) {
        for (const { container, item } of GROUP_SELECTORS) {
            const box = sourceEl.closest(container);
            if (!box) continue;
            const els = Array.from(box.querySelectorAll(item)).filter((el) => el.src);
            const index = els.indexOf(sourceEl);
            if (index >= 0) return { items: els.map((el) => el.src), index };
        }
    }
    return { items: [url], index: 0 };
}

export function openImageViewer(target) {
    if (!root) buildViewer();
    const sourceEl = target instanceof HTMLImageElement ? target : null;
    const url = sourceEl ? sourceEl.src : String(target || '');
    if (!url) return;

    const { items, index } = collectGroup(sourceEl, url);
    state.items = items;
    root.classList.add('open');
    root.classList.remove('hide-ui');
    show(index);

    if (!state.pushedHistory) {
        history.pushState({ imageViewer: true }, '');
        state.pushedHistory = true;
    }
}

export function closeImageViewer() {
    if (!root || !root.classList.contains('open')) return;
    if (state.pushedHistory) {
        // popstate 핸들러에서 실제로 닫음 (안드로이드 뒤로가기와 동작을 맞추기 위해)
        history.back();
    } else {
        hideViewer();
    }
}

function hideViewer() {
    root.classList.remove('open');
    img.removeAttribute('src');
    state.items = [];
}

function show(index) {
    state.index = Math.max(0, Math.min(index, state.items.length - 1));
    state.rotation = 0;
    resetZoom();
    img.classList.remove('animate');
    img.style.transform = '';
    img.src = state.items[state.index];

    const total = state.items.length;
    counterEl.textContent = total > 1 ? `${state.index + 1} / ${total}` : '';
    prevBtn.hidden = total <= 1;
    nextBtn.hidden = total <= 1;
    prevBtn.disabled = state.index === 0;
    nextBtn.disabled = state.index === total - 1;
}

function go(delta) {
    const nextIndex = state.index + delta;
    if (nextIndex < 0 || nextIndex >= state.items.length) return;
    show(nextIndex);
}

function rotate() {
    state.rotation += 90;
    resetZoom();
    applyTransform(true);
}

function resetZoom() {
    state.zoom = 1;
    state.tx = 0;
    state.ty = 0;
}

// 90도/270도 회전 시 화면에 꽉 차도록 맞추는 배율
function getFitScale() {
    const sideways = (state.rotation / 90) % 2 === 1;
    if (!sideways || !img.offsetWidth || !img.offsetHeight) return 1;
    return Math.min(stage.clientWidth / img.offsetHeight, stage.clientHeight / img.offsetWidth);
}

function clampPan() {
    const sideways = (state.rotation / 90) % 2 === 1;
    const scale = getFitScale() * state.zoom;
    const w = (sideways ? img.offsetHeight : img.offsetWidth) * scale;
    const h = (sideways ? img.offsetWidth : img.offsetHeight) * scale;
    const maxX = Math.max(0, (w - stage.clientWidth) / 2);
    const maxY = Math.max(0, (h - stage.clientHeight) / 2);
    state.tx = Math.max(-maxX, Math.min(maxX, state.tx));
    state.ty = Math.max(-maxY, Math.min(maxY, state.ty));
}

function applyTransform(animate) {
    img.classList.toggle('animate', !!animate);
    clampPan();
    const scale = getFitScale() * state.zoom;
    img.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0) rotate(${state.rotation}deg) scale(${scale})`;
}

function bindGestures() {
    const pointers = new Map();
    let gesture = null;
    let lastTap = 0;

    stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        stage.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 2) {
            const [a, b] = Array.from(pointers.values());
            gesture = { type: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y), startZoom: state.zoom };
        } else if (pointers.size === 1) {
            gesture = { type: 'drag', startX: e.clientX, startY: e.clientY, tx: state.tx, ty: state.ty, moved: false };
        }
    });

    stage.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId) || !gesture) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (gesture.type === 'pinch' && pointers.size >= 2) {
            const [a, b] = Array.from(pointers.values());
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            state.zoom = Math.max(1, Math.min(5, gesture.startZoom * dist / gesture.startDist));
            applyTransform(false);
        } else if (gesture.type === 'drag') {
            const dx = e.clientX - gesture.startX;
            const dy = e.clientY - gesture.startY;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) gesture.moved = true;
            if (state.zoom > 1) {
                state.tx = gesture.tx + dx;
                state.ty = gesture.ty + dy;
                applyTransform(false);
            } else {
                // 확대 안 된 상태: 좌우로 따라 움직이며 넘기기 미리보기
                state.tx = dx;
                state.ty = 0;
                img.classList.remove('animate');
                img.style.transform = `translate3d(${dx}px, 0, 0) rotate(${state.rotation}deg) scale(${getFitScale()})`;
            }
        }
    });

    const endPointer = (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        if (!gesture) return;

        if (gesture.type === 'pinch') {
            if (pointers.size === 0) {
                if (state.zoom <= 1.02) resetZoom();
                applyTransform(true);
                gesture = null;
            }
            return;
        }

        const dx = e.clientX - gesture.startX;
        const dy = e.clientY - gesture.startY;

        if (!gesture.moved) {
            const now = Date.now();
            if (now - lastTap < 300) {
                // 더블탭: 2.5배 확대 / 원래대로
                lastTap = 0;
                if (state.zoom > 1) {
                    resetZoom();
                } else {
                    state.zoom = 2.5;
                    const rect = stage.getBoundingClientRect();
                    state.tx = (rect.left + rect.width / 2 - e.clientX) * 1.5;
                    state.ty = (rect.top + rect.height / 2 - e.clientY) * 1.5;
                }
                applyTransform(true);
            } else {
                lastTap = now;
                setTimeout(() => {
                    if (lastTap === now) root.classList.toggle('hide-ui');
                }, 300);
            }
        } else if (state.zoom === 1) {
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                const before = state.index;
                go(dx < 0 ? 1 : -1);
                if (state.index === before) {
                    state.tx = 0;
                    applyTransform(true);
                }
            } else if (dy > 120 && Math.abs(dy) > Math.abs(dx)) {
                closeImageViewer();
            } else {
                state.tx = 0;
                applyTransform(true);
            }
        }
        gesture = null;
    };

    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        state.zoom = Math.max(1, Math.min(5, state.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        if (state.zoom === 1) resetZoom();
        applyTransform(false);
    }, { passive: false });
}

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function getExtensionFromMime(type = '') {
    const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic' };
    return map[type] || 'jpg';
}

function buildFileName(type) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `jaengang_${stamp}.${getExtensionFromMime(type)}`;
}

async function saveCurrent() {
    const url = state.items[state.index];
    if (!url || saveBtn.disabled) return;
    saveBtn.disabled = true;

    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const fileName = buildFileName(blob.type);
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

        // 모바일(특히 iOS)은 공유 시트의 "이미지 저장"이 가장 확실함
        const isTouch = window.matchMedia('(hover: none)').matches;
        if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file] });
            } catch (error) {
                if (error.name !== 'AbortError') throw error;
            }
            return;
        }

        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showToast('사진을 저장했어요.');
    } catch (error) {
        console.warn('이미지 저장 실패, 새 창으로 대체:', error);
        window.open(url, '_blank', 'noopener');
        showToast('새 창에서 이미지를 길게 눌러 저장해주세요.');
    } finally {
        saveBtn.disabled = false;
    }
}
