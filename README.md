# URL 모니터링 대시보드

URL 모니터링 및 체크 대시보드입니다. 사용자가 업로드한 URL 목록을 기준으로 특정 날짜(Run)에 URL을 점검하고 결과를 저장/조회할 수 있습니다.

## 중요 안내

**⚠️ 반드시 이 프로젝트 폴더만 Open Folder로 열어서 작업하세요.**

모든 데이터는 `data/` 폴더 내부에 영구 저장되며, 세션/재실행/재부팅 후에도 유지됩니다.

## 기술 스택

- Next.js 14+ (App Router) + TypeScript
- SQLite + Prisma
- Tailwind CSS
- 서버 사이드 fetch 기반 URL 체크

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 데이터베이스 초기화

```bash
npm run db:generate
npm run db:push
```

또는

```bash
npm run db:migrate
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 데이터 구조

모든 영구 데이터는 `data/` 폴더에 저장됩니다:

- `data/app.db` - SQLite 데이터베이스
- `data/uploads/` - 업로드된 CSV 파일
- `data/snapshots/` - 증거 HTML 저장 (선택)
- `data/logs/` - 로그 파일 (선택)

## CSV 업로드 형식

CSV 파일은 다음 헤더를 포함해야 합니다:

```csv
keyword,url,currentStatus,myComment
키워드1,https://example.com/page1,노출,테스트용
키워드2,https://example.com/page2,미노출,
```

- `keyword`: 필수 - 키워드
- `url`: 필수 - 체크할 URL (unique)
- `currentStatus`: 선택 - 현재 상태
- `myComment`: 선택 - 코멘트

같은 URL이 이미 있으면 `keyword`, `currentStatus`, `myComment`가 업데이트됩니다.

## 주요 기능

### 1. URL 목록 업로드
- CSV 파일을 업로드하여 targets 목록을 관리합니다.

### 2. Run 단위 체크
- "오늘 전체 재검사" 버튼으로 모든 URL을 한 번에 체크합니다.
- Run은 날짜 단위(YYYY-MM-DD)로 관리됩니다.

### 3. 개별 URL 체크
- 테이블의 각 행에 있는 "체크" 버튼으로 개별 URL을 재검사할 수 있습니다.

### 4. 변경 감지
- 베이스라인(기본: 가장 오래된 Run)과 현재 선택한 Run을 비교하여 변경사항을 감지합니다.
- 변경된 항목만 표시되며, 변경이 없으면 "변경 없음"으로 표시됩니다.

### 5. 필터링 및 정렬
- 필터: 전체/노출만/미노출만/PDF만/에러만/변경만
- 정렬: 통합노출, PDF노출, 마지막체크시간

## 체크 로직

각 URL 체크 시 다음 정보를 수집합니다:

1. **HTTP 상태 코드**: 응답 상태 코드
2. **최종 URL**: 리다이렉트를 따라간 최종 URL
3. **PDF 여부**: Content-Type 또는 URL 확장자로 판별
4. **통합 노출**: 응답 본문 또는 URL에 "academic.naver.com" 포함 여부
5. **에러 메시지**: 체크 중 발생한 오류

## API 엔드포인트

- `GET /api/targets` - targets 리스트
- `POST /api/targets/upload` - CSV 업로드
- `GET /api/runs` - run 리스트
- `POST /api/runs/today` - 오늘 run 생성 + 전체 재검사
- `POST /api/check/:targetId` - 개별 URL 체크
- `GET /api/dashboard?runDate=YYYY-MM-DD&baselineRunDate=YYYY-MM-DD` - 대시보드 데이터

## 데이터베이스 스키마

### Target
- id, keyword, url (unique), currentStatus, myComment, createdAt, updatedAt

### Run
- id, runDate (unique, YYYY-MM-DD), createdAt

### RunResult
- id, runId, targetId, foundAcademicNaver, isPdf, httpStatus, finalUrl, checkedAt, errorMessage
- unique(runId, targetId)

### UploadHistory
- id, fileName, filePath, recordCount, uploadedAt

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 마이그레이션
npm run db:migrate

# Prisma Studio (DB GUI)
npm run db:studio
```

## 주의사항

- 모든 날짜는 Asia/Seoul 기준으로 처리됩니다.
- URL 체크는 타임아웃 15초로 설정되어 있습니다.
- 전체 재검사 시 동시성 제한(5개)이 적용됩니다.
- 데이터베이스 파일(`data/app.db`)은 `.gitignore`에 포함되어 있으므로 Git에 커밋되지 않습니다.

## 라이선스

MIT

