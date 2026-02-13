// js/i18n.js
(function initI18n() {
    const DICT = {
        ko: {
            'ui.time': '시간',
            'ui.cost': '코스트: {current} / {max}',
            'ui.reset': '리셋',
            'ui.go': '출격',
            'ui.deck': '덱',
            'ui.discard': '무덤',
            'ui.sealedTitle': '봉인 카드 목록',
            'ui.cardList': '카드 목록',
            'ui.popupTitle': '알림',
            'ui.popupMessage': '메시지 내용',
            'ui.cancel': '취소',
            'ui.confirm': '확인',
            'ui.mapEditor': '맵 에디터',

            'title.start': '게임 시작',
            'title.setting': '설정',
            'title.cardList': '카드 목록',
            'title.exit': '종료',
            'title.exitConfirm': '게임을 종료하시겠습니까?',
            'title.exitFallback': '게임 종료 (창을 닫아주세요)',
            'title.cardListTitle': '카드 목록',

            'settings.title': '설정',
            'settings.language': '언어',
            'settings.close': '닫기',
            'settings.ko': '한국어',
            'settings.en': 'English',

            'commander.title': '지휘관 선택',
            'commander.hp': 'HP: {hp}',
            'commander.select': '선택',

            'map.actionButton': '버튼',
            'map.playerMarker': 'ME',
            'map.move': '이동 ({dist}km)',
            'map.selectTarget': '현재 위치에서 목표 선택',
            'map.idle': '대기 중...',
            'map.enterBattle': '전투 시작',
            'map.enterElite': '엘리트 전투',
            'map.enterBoss': '보스전 입장',
            'map.enterShop': '상점 입장',
            'map.enterEvent': '이벤트 확인',
            'map.moveFailed': '이동 실패',
            'map.notConnected': '연결되지 않은 지점입니다!',
            'map.selectAdjacent': '인접 지점의 노드를 눌러 이동할 곳을 선택하세요.',
            'map.eventLoadFail': '이벤트 시스템 로드 실패',
            'map.previewInfo': '거리: {dist}km\n위험도 +{risk} (예상)',
            'map.deadlineGameOver': '데드라인에 따라잡혔습니다. GAME OVER',
            'map.statusInfo': 'HP: {hp}\nGold: {gold}\n격차: {gap}km',

            'shop.title': '용병 아카이브',
            'shop.gold': '보유 골드',
            'shop.leave': '상점 떠나기',
            'shop.leaveConfirm': '정말로 상점을 떠나시겠습니까?\n지금 나가면 다시 입장할 수 없습니다.',
            'shop.service.remove': '카드 제거',
            'shop.service.removeDesc': '덱에서 불필요한 카드 1장을 제거합니다.',
            'shop.cardStat': '비용: {cost} | 공격력: {atk}',
            'shop.artifact': '유물',
            'shop.sold': '품절',
            'shop.goldLack': '골드가 부족합니다.',
            'shop.buyDone': '구매 완료',
            'shop.buyCardDone': '[{name}] 카드가 덱에 추가되었습니다.',
            'shop.buyArtifactDone': '[{name}] 유물을 획득했습니다.',
            'shop.keepMinDeck': '최소 5장의 카드는 보유해야 합니다.',
            'shop.pickRemoveCard': '제거할 카드를 선택하세요',
            'shop.removeConfirmTitle': '카드 제거 확인',
            'shop.removeConfirmMessage': '[{name}] 카드를 제거하시겠습니까?\n(비용: {cost} G)',
            'shop.error': '오류',
            'shop.removeDoneTitle': '제거 완료',
            'shop.removeDoneMessage': '[{name}] 카드를 불태웠습니다!',

            'battle.stageTurn': '스테이지 {stage} / 턴 {turn}',
            'battle.roundInProgress': '턴 {turn} 진행 중',
            'battle.roundReady': '턴 {turn} 준비',
            'battle.roundStartLog': '턴 {turn} 시작',
            'battle.roundEndLog': '턴 종료. 코스트가 회복됩니다.',
            'battle.gameOver': '게임 오버',
            'battle.warnTitle': '경고',
            'battle.handOverflow': '패가 최대치를 초과했습니다!\n({current}/{max})\n\n카드를 사용해 공간을 비워주세요.',
            'battle.gameOverTitle': '게임 오버',
            'battle.gameOverReset': '{reason}\n\n모든 데이터가 초기화됩니다.',
            'battle.endByTime': '전투 종료! 전선 거리 판정...',
            'battle.spawnDataMissing': '유닛 데이터 없음: {name}',
            'battle.spawnDataNotFound': '유닛 데이터를 찾을 수 없음: {name}',
            'battle.spawnCreateFail': '유닛 생성 실패: {name}',
            'battle.combatManagerMissing': 'CombatManager가 초기화되지 않았습니다.',
            'battle.enemyDataMissing': '적 ID({id}) 데이터 없음. 기본값 사용.',
            'battle.winEnemyBase': '적 기지 파괴!',
            'battle.loseAllyBase': '아군 기지가 파괴되었습니다.',
            'battle.timeOverAdv': '제한 시간 종료 (우세)',
            'battle.timeOverDisadv': '제한 시간 종료 (적 체력이 더 높습니다)',
            'battle.victoryTitle': '승리',
            'battle.victorySubtitle': '전투 승리! 보상을 선택하세요.',
            'battle.skipReward': '건너뛰기 (골드 +50)',
            'battle.rewardGot': '획득 완료',
            'battle.rewardGotMsg': '[{name}] 카드를 획득했습니다.\n(골드 +50)',
            'battle.rewardAlert': '[{name}] 획득!',
            'battle.defeatLog': '패배...',
            'battle.defaultDefeatReason': '전투에서 패배했습니다.',
            'battle.timingBonus': '타이밍 보너스! ({bonus})',
            'battle.timingBonusTitle': 'TIMING BONUS!',
            'battle.viewerDeck': '덱',
            'battle.viewerDiscard': '무덤',
            'battle.viewerSealed': '봉인'
        },
        en: {
            'ui.time': 'Time',
            'ui.cost': 'Cost: {current} / {max}',
            'ui.reset': 'Reset',
            'ui.go': 'GO',
            'ui.deck': 'DECK',
            'ui.discard': 'DISCARD',
            'ui.sealedTitle': 'Sealed Cards',
            'ui.cardList': 'Card List',
            'ui.popupTitle': 'Notice',
            'ui.popupMessage': 'Message',
            'ui.cancel': 'Cancel',
            'ui.confirm': 'Confirm',
            'ui.mapEditor': 'Map Editor',

            'title.start': 'GAME START',
            'title.setting': 'SETTING',
            'title.cardList': 'CARD LIST',
            'title.exit': 'EXIT',
            'title.exitConfirm': 'Do you want to quit the game?',
            'title.exitFallback': 'Game exit (please close the window).',
            'title.cardListTitle': 'Card List',

            'settings.title': 'Settings',
            'settings.language': 'Language',
            'settings.close': 'Close',
            'settings.ko': 'Korean',
            'settings.en': 'English',

            'commander.title': 'Choose Your Commander',
            'commander.hp': 'HP: {hp}',
            'commander.select': 'SELECT',

            'map.actionButton': 'Button',
            'map.playerMarker': 'ME',
            'map.move': 'Move ({dist}km)',
            'map.selectTarget': 'Select a target from your current position',
            'map.idle': 'Idle...',
            'map.enterBattle': 'Start Battle',
            'map.enterElite': 'Elite Battle',
            'map.enterBoss': 'Enter Boss Fight',
            'map.enterShop': 'Enter Shop',
            'map.enterEvent': 'Check Event',
            'map.moveFailed': 'Move failed',
            'map.notConnected': 'This node is not connected!',
            'map.selectAdjacent': 'Select an adjacent node to move.',
            'map.eventLoadFail': 'Failed to load event system',
            'map.previewInfo': 'Distance: {dist}km\nDanger +{risk} (est.)',
            'map.deadlineGameOver': 'The deadline has caught up. GAME OVER',
            'map.statusInfo': 'HP: {hp}\nGold: {gold}\nGap: {gap}km',

            'shop.title': 'MERCENARY ARCHIVE',
            'shop.gold': 'Gold',
            'shop.leave': 'Leave Shop',
            'shop.leaveConfirm': 'Do you really want to leave the shop?\nYou cannot re-enter once you leave.',
            'shop.service.remove': 'Remove Card',
            'shop.service.removeDesc': 'Remove 1 unwanted card from your deck.',
            'shop.cardStat': 'Cost: {cost} | ATK: {atk}',
            'shop.artifact': 'Artifact',
            'shop.sold': 'SOLD',
            'shop.goldLack': 'Not enough gold.',
            'shop.buyDone': 'Purchase Complete',
            'shop.buyCardDone': '[{name}] card added to deck.',
            'shop.buyArtifactDone': '[{name}] artifact acquired.',
            'shop.keepMinDeck': 'You must keep at least 5 cards in your deck.',
            'shop.pickRemoveCard': 'Select a card to remove',
            'shop.removeConfirmTitle': 'Confirm Card Removal',
            'shop.removeConfirmMessage': 'Remove [{name}]?\n(Cost: {cost} G)',
            'shop.error': 'Error',
            'shop.removeDoneTitle': 'Removal Complete',
            'shop.removeDoneMessage': '[{name}] has been burned.',

            'battle.stageTurn': 'Stage {stage} / Turn {turn}',
            'battle.roundInProgress': 'Turn {turn} in progress',
            'battle.roundReady': 'Turn {turn} ready',
            'battle.roundStartLog': 'Turn {turn} start',
            'battle.roundEndLog': 'Turn ended. Cost recovered.',
            'battle.gameOver': 'GAME OVER',
            'battle.warnTitle': 'Warning',
            'battle.handOverflow': 'Hand size exceeded!\n({current}/{max})\n\nUse cards to free up space.',
            'battle.gameOverTitle': 'GAME OVER',
            'battle.gameOverReset': '{reason}\n\nAll run data will be reset.',
            'battle.endByTime': 'Battle finished! Frontline distance check...',
            'battle.spawnDataMissing': 'Missing unit data: {name}',
            'battle.spawnDataNotFound': 'Unit data not found: {name}',
            'battle.spawnCreateFail': 'Unit creation failed: {name}',
            'battle.combatManagerMissing': 'CombatManager is not initialized.',
            'battle.enemyDataMissing': 'Enemy ID ({id}) not found. Using fallback.',
            'battle.winEnemyBase': 'Enemy base destroyed!',
            'battle.loseAllyBase': 'Your base was destroyed.',
            'battle.timeOverAdv': 'Time over (advantage)',
            'battle.timeOverDisadv': 'Time over (enemy has more base HP)',
            'battle.victoryTitle': 'VICTORY',
            'battle.victorySubtitle': 'Battle won! Choose a reward.',
            'battle.skipReward': 'Skip (+50 gold)',
            'battle.rewardGot': 'Acquired',
            'battle.rewardGotMsg': '[{name}] card acquired.\n(+50 gold)',
            'battle.rewardAlert': '[{name}] acquired!',
            'battle.defeatLog': 'Defeat...',
            'battle.defaultDefeatReason': 'You were defeated in battle.',
            'battle.timingBonus': 'Timing bonus! ({bonus})',
            'battle.timingBonusTitle': 'TIMING BONUS!',
            'battle.viewerDeck': 'Deck',
            'battle.viewerDiscard': 'Discard',
            'battle.viewerSealed': 'Sealed'
        }
    };

    const STORAGE_KEY = 'ct.lang';
    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

    const resolveInitial = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && hasOwn(DICT, stored)) return stored;
        const nav = (navigator.language || '').toLowerCase();
        return nav.startsWith('ko') ? 'ko' : 'en';
    };

    let currentLang = resolveInitial();

    function t(key, params) {
        const pack = DICT[currentLang] || DICT.ko;
        const fallback = DICT.ko;
        let value = hasOwn(pack, key) ? pack[key] : (hasOwn(fallback, key) ? fallback[key] : key);
        if (params && typeof params === 'object') {
            Object.keys(params).forEach((k) => {
                value = value.replaceAll(`{${k}}`, String(params[k]));
            });
        }
        return value;
    }

    function applyStaticI18n() {
        const nodes = document.querySelectorAll('[data-i18n]');
        nodes.forEach((node) => {
            const key = node.getAttribute('data-i18n');
            if (!key) return;
            node.textContent = t(key);
        });
        const attrNodes = document.querySelectorAll('[data-i18n-title]');
        attrNodes.forEach((node) => {
            const key = node.getAttribute('data-i18n-title');
            if (!key) return;
            node.setAttribute('title', t(key));
        });
    }

    function setLanguage(lang) {
        if (!hasOwn(DICT, lang) || currentLang === lang) return;
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        applyStaticI18n();
        document.dispatchEvent(new CustomEvent('ct:langchange', { detail: { lang } }));
    }

    function getLanguage() {
        return currentLang;
    }

    window.t = t;
    window.setLanguage = setLanguage;
    window.getLanguage = getLanguage;
    window.applyStaticI18n = applyStaticI18n;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStaticI18n, { once: true });
    } else {
        applyStaticI18n();
    }
})();

