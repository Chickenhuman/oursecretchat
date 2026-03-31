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

export const CURRENT_VERSION = "1.11";
export const RELEASE_DATE = "2026/03/31";
export const PATCH_NOTES = [
    "복사 붙여넣기한 이미지 전송이 더 안정적으로 되도록 업로드 흐름을 다듬었어요.",
    "로그인 준비 전에는 이미지 전송이 서두르지 않도록 인증 대기 처리를 보강했어요.",
    "이미지 전송 실패 시 원인을 더 쉽게 확인할 수 있게 안내와 로그를 보강했어요."
];
export const UPDATE_SIGNATURE = `${CURRENT_VERSION}|${RELEASE_DATE}|${PATCH_NOTES.join("||")}`;
