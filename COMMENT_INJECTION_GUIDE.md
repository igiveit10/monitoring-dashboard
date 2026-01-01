# 코멘트 주입 가이드

## 개요

이 문서는 모니터링 결과의 코멘트를 DB에 일괄 주입하는 방법을 설명합니다.

## "비고" 컬럼 소스

- **모니터링 테이블의 "비고" 컬럼**: `RunResult.comment` 우선, 없으면 `Target.myComment`
- **날짜별 셀의 작은 코멘트**: `RunResult.comment` (모니터링 결과 코멘트)

## 코멘트 주입 스크립트

### 파일 위치
`scripts/apply-comments.ts`

### 실행 방법

#### 로컬 환경
```bash
npx tsx scripts/apply-comments.ts
```

#### Render 환경
1. Render 대시보드에서 서비스 선택
2. "Shell" 탭 클릭
3. 다음 명령 실행:
```bash
npx tsx scripts/apply-comments.ts
```

### 주입 대상
- **테이블**: `RunResult`
- **기준**: `targetId` + `runDate` (2025-12-31)
- **필드**: `comment`

### 코멘트 매핑
스크립트 내부의 `COMMENT_MAPPING` 객체에 정의되어 있습니다:
- `d234086916`: 제안검색 수정
- `d1003260531`: 다른논문, Seckel 증후군 환자의 전신마취경험 - 증례보고 -
- 등등...

## 검증 방법

### 1. SQL로 확인
```sql
SELECT rr.id, rr."targetId", t.keyword, rr.comment
FROM "RunResult" rr
JOIN "Run" r ON rr."runId" = r.id
JOIN "Target" t ON rr."targetId" = t.id
WHERE r."runDate" = '2025-12-31'
  AND rr.comment IS NOT NULL
  AND rr.comment != ''
ORDER BY t.keyword;
```

### 2. API로 확인
```bash
curl "https://your-app.onrender.com/api/dashboard?runDate=2025-12-31" | jq '.tableData[] | select(.id == "d234086916") | .myComment'
```

### 3. UI에서 확인
1. 대시보드 접속
2. 날짜 선택: 2025-12-31
3. "비고" 컬럼에서 코멘트가 표시되는지 확인

## 재발 방지

`scripts/seed-runs.ts`에서 빈 문자열이 기존 코멘트를 덮어쓰지 않도록 처리되어 있습니다:

- CSV comment가 비어있으면 (`trim()` 후 빈 문자열) `update`/`create`에 `comment` 필드를 포함하지 않음
- 기존 DB comment가 있는 경우 보존됨
- 로그에 `commentUpdatedCount`와 `commentSkippedEmptyCount` 출력

## 보안 주의사항

⚠️ **중요**: 이 스크립트는 관리자만 실행해야 하며, 외부 공개 API로 노출되면 안 됩니다.

- Render Shell에서만 실행
- 환경변수 `ADMIN_TOKEN` 등으로 보호하지 않음 (스크립트 자체가 관리자 전용)
- 프로덕션에서 외부에서 접근 가능한 API 엔드포인트로 만들지 말 것

