// js/items.js - 게임 데이터 모음

// 1. 먹이 목록
export const FOODS = [
    { id: 'hay', name: '마른 건초', price: 1000, fatigueRec: 15, bond: 1, desc: "가성비 좋은 기본 식사" },
    { id: 'carrot', name: '특제 당근', price: 5000, fatigueRec: 40, bond: 3, desc: "말들이 아주 좋아합니다" },
    { id: 'ginseng', name: '산삼 엑기스', price: 30000, fatigueRec: 100, bond: 10, desc: "죽은 말도 벌떡 일어납니다" }
];

// 2. 훈련 목록
export const TRAININGS = [
    { id: 'treadmill', name: '러닝머신', cost: 2000, stat: 'spd', min: 1, max: 3, fatigue: 20, fail: 0.05, desc: "속도(SPD) 강화" },
    { id: 'swim', name: '수영장', cost: 2000, stat: 'sta', min: 1, max: 3, fatigue: 25, fail: 0.05, desc: "체력(STA) 강화" },
    { id: 'meditation', name: '폭포수 명상', cost: 3000, stat: 'luk', min: 1, max: 2, fatigue: 15, fail: 0.05, desc: "행운(LUK) 강화" },
    { id: 'hell', name: '지옥 훈련', cost: 10000, stat: 'all', min: 2, max: 5, fatigue: 50, fail: 0.30, desc: "전 능력치 대폭 상승 (부상 위험!)" }
];

// 3. 장비 가챠 확률 (악랄함 주의)
export const GACHA_PRICE = 50000; // 1회 뽑기 비용
export const EQUIPMENT_TIERS = [
    { grade: 'C', prob: 60, power: 2, color: '#7f8c8d' },  // 60%
    { grade: 'B', prob: 25, power: 5, color: '#3498db' },  // 25%
    { grade: 'A', prob: 10, power: 10, color: '#e74c3c' }, // 10%
    { grade: 'S', prob: 4, power: 20, color: '#f1c40f' },  // 4%
    { grade: 'SS', prob: 1, power: 50, color: '#9b59b6' }  // 1% (전설)
];

// 4. 말 이름 생성용 단어
export const ADJECTIVES = ["바람", "천둥", "황금", "불꽃", "무적", "날쌘", "거대", "미친", "행운", "폭풍", "강철", "신비", "어둠", "빛의", "귀염", "재은", "경환"];
export const NOUNS = ["돌이", "순이", "토마", "대장", "기사", "요정", "망치", "주먹", "날개", "발톱", "호랑", "사자", "토끼", "독수리", "상어", "공주", "왕자"];