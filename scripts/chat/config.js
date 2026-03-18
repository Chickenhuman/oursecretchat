export const firebaseConfig = {
  apiKey: "AIzaSyDTMfB6Fl6QiiJdcTjpcU9nha2GP4Ne_6o",
  authDomain: "lovechatproject-2db11.firebaseapp.com",
  projectId: "lovechatproject-2db11",
  storageBucket: "lovechatproject-2db11.firebasestorage.app",
  messagingSenderId: "1069136590072",
  appId: "1:1069136590072:web:7712e718db03c70bff370d",
  measurementId: "G-ERG2LL283F"
};

export const STICKER_PACKS = [
    {
        name: "토끼와 곰돌이",
        icon: "🐰🐻",
        url: "https://github.com/Chickenhuman/oursecretchat/blob/main/emoticon1.png?raw=true",
        totalWidth: 1024,
        totalHeight: 559,
        cols: 4,
        count: 8
    },
    {
        name: "러블리 곰",
        icon: "🐻",
        url: "https://raw.githubusercontent.com/ChickenHuman/oursecretchat/main/stickers_bear.png",
        totalWidth: 1024,
        totalHeight: 512,
        cols: 4,
        count: 8
    }
];

export const emojiList = ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","🥰","😍","😘","😊","🤣","😂","🥲","🥺","👍","👎","👏","🙏","🎉","🎂","🎁","💋","💍"];

export const CURRENT_VERSION = "1.10";
export const RELEASE_DATE = "2026/03/18";
export const PATCH_NOTES = [
    "사무실에서 쓰기 쉽게 기본 테마와 엑셀 테마를 오갈 수 있게 했어요.",
    "그날 첫 메시지에서도 날짜 구분선이 바로 보이도록 고쳤어요.",
    "채팅 특수문자와 링크 처리 안정성을 더 다듬었어요.",
    "채팅 진입 흐름과 클릭 처리 안정성을 더 다듬었어요.",
    "예전 메시지와 사진 불러오기 실패 시 복구 처리를 보강했어요.",
    "대화 전체 삭제 시 첨부 이미지 정리도 함께 보강했어요."
];
export const UPDATE_SIGNATURE = `${CURRENT_VERSION}|${RELEASE_DATE}|${PATCH_NOTES.join("||")}`;
