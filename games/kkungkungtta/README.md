# 잰갱따리잰갱따 MVP

채팅방의 승인된 Google 계정 두 개만 자동으로 같은 `couple` 게임방에 입장합니다. 첫 참가자가 방장이 되며, 두 번째 참가자가 들어오면 게임을 시작할 수 있습니다.

## 구성

- `index.html`, `style.css`, `app.js`: 모바일/PC 게임 화면, Firestore 실시간 구독, 서버 함수 호출, 서버 마감 시각 기반 타이머 표시
- `../../functions/index.js`: 참가, 시작/재시작, 단어 제출, 시간 초과 확정, 포기 처리
- `../../functions/gameEngine.js`: 단어 정규화, 글자 수/끝말/중복 판정, 가속 타이머 계산
- `../../firestore.rules`: 승인 사용자에게 게임 상태 읽기만 허용하고 모든 게임 쓰기는 서버로 제한

## 단어 판정

서버가 다음 순서로 판정합니다.

1. 한글 음절만 사용했는지 확인
2. 설정한 글자 수(2~4글자 또는 무제한) 확인
3. 이전 단어의 마지막 글자로 시작하는지 확인
4. 현재 판에서 이미 사용했는지 확인
5. 국립국어원 표준국어대사전 Open API에서 정확히 일치하는 표제어인지 확인

사전 조회 결과는 Firestore `korean_word_cache`에 저장합니다. 인정된 단어는 180일, 인정되지 않은 단어는 14일 동안 재사용해 같은 단어를 반복해서 외부 API에 묻지 않습니다. 외부 사전이 일시적으로 실패하면 패배 처리하지 않고 해당 턴 시간을 다시 줍니다.

## 배포 전 필요한 값

국립국어원 표준국어대사전에서 Open API 인증 키를 발급받은 뒤 Firebase Secret Manager에 `STDICT_API_KEY`라는 이름으로 저장해야 합니다.

```text
firebase functions:secrets:set STDICT_API_KEY --project lovechatproject-2db11
firebase deploy --only functions,firestore:rules --project lovechatproject-2db11
```

Cloud Functions 배포에는 Firebase Blaze 요금제가 필요합니다. 함수에는 `maxInstances: 5`를 설정해 소규모 개인용 게임에서 예상치 못한 확장을 제한했습니다.

## 검사

`functions` 폴더에서 의존성을 설치한 뒤 `pnpm test`를 실행하면 단어 정규화, 길이, 끝말 연결, 중복, 설정 범위, 가속 타이머와 2인 턴 흐름을 검사합니다.
