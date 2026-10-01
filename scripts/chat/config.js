export const firebaseConfig = {
  apiKey: "AIzaSyDTMfB6Fl6QiiJdcTjpcU9nha2GP4Ne_6o",
  authDomain: "lovechatproject-2db11.firebaseapp.com",
  projectId: "lovechatproject-2db11",
  storageBucket: "lovechatproject-2db11.firebasestorage.app",
  messagingSenderId: "1069136590072",
  appId: "1:1069136590072:web:7712e718db03c70bff370d",
  measurementId: "G-ERG2LL283F"
};

export const googleWebClientId = "1069136590072-5u6dvoeegaes22bc88pqe9osqdffs0fd.apps.googleusercontent.com";

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

export const CURRENT_VERSION = "1.27";
export const RELEASE_DATE = "2026/10/01";
export const PATCH_NOTES = [
    "사진을 누르면 새 창 대신 전체화면 뷰어로 열려요. 회전, 저장, 좌우로 넘기기, 두 손가락·두 번 탭 확대를 지원하고 뒤로가기나 아래로 쓸어내리기로 닫을 수 있어요.",
    "게임 탭에 승인된 두 사람만 참여하는 잰갱따리잰갱따를 추가했어요. 글자 수와 제한 시간을 바꾸고, 서버 사전 판정과 점점 빨라지는 턴을 지원합니다.",
    "기존 비밀번호 입장 방식을 없애고 Google 승인 로그인으로 바꿔, 허용한 계정만 채팅과 캘린더에 들어올 수 있게 했어요.",
    "별칭을 계정 프로필로 관리하고, 새 이미지/문서는 저장 URL 대신 storagePath만 저장하도록 바꿨어요.",
    "이미지 자동 압축, 문서 타입/용량 제한, Firestore·Storage 보안 규칙 정비로 업로드 안전장치를 강화했어요.",
    "GitHub Pages에서도 모바일 브라우저 Google 로그인이 더 안정적으로 이어지도록 Google Identity Services 기반 로그인 흐름을 추가했어요."
];
export const UPDATE_SIGNATURE = `${CURRENT_VERSION}|${RELEASE_DATE}|${PATCH_NOTES.join("||")}`;
