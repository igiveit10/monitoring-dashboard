# 초기 데이터 로드 가이드

Render(Postgres)로 전환된 앱에서 targets 데이터를 초기 로드하는 방법입니다.

## 방법 1: 관리용 API 엔드포인트 사용 (권장)

### 1. 환경 변수 설정
Render 대시보드에서 `ADMIN_TOKEN` 환경 변수를 설정합니다.
```bash
ADMIN_TOKEN=your-secret-token-here
```

### 2. CSV 파일 준비
`data/targets.csv` 파일을 준비합니다. 다음 형식을 지원합니다:

**표준 형식:**
```csv
keyword,url,currentStatus,myComment
키워드1,https://example.com,노출,비고
```

**QA 형식:**
```csv
_id,title,통검url3,통검노출,PDF 노출,비고
id1,제목1,https://example.com,Y,Y,비고
```

### 3. CSV 파일 업로드
프로젝트 루트에 `data/targets.csv` 파일을 추가하고 커밋/푸시합니다.

### 4. API 호출
```bash
curl -X POST https://your-app.onrender.com/api/admin/seed \
  -H "Authorization: Bearer your-secret-token-here"
```

성공 응답:
```json
{
  "success": true,
  "message": "Seeding completed",
  "stats": {
    "created": 100,
    "updated": 0,
    "skipped": 0,
    "total": 100
  }
}
```

## 방법 2: Render Shell에서 직접 실행

### 1. Render Shell 접속
Render 대시보드에서 "Shell" 탭을 열거나 SSH로 접속합니다.

### 2. 명령어 실행
```bash
npx tsx scripts/seed-targets.ts
```

출력 예시:
```
Seeding database from CSV...
Found CSV file at: /opt/render/project/src/data/targets.csv
Parsed 100 records from CSV

Seeding completed!
  - Created: 100
  - Updated: 0
  - Skipped: 0
  - Total targets in DB: 100
```

## CSV 파일 위치 우선순위

스크립트는 다음 순서로 CSV 파일을 찾습니다:
1. `data/targets.csv`
2. `scripts/targets.csv`
3. `sample.csv`

## 확인 방법

### 대시보드 API 확인
```bash
curl https://your-app.onrender.com/api/dashboard
```

서버 로그에서 다음 메시지를 확인할 수 있습니다:
```
[Dashboard API] Total targets in DB: 100
[Dashboard API] Fetched 100 targets from DB
```

### 업로드 후 확인
CSV 파일을 업로드하면 응답에 `totalTargets` 필드가 포함됩니다:
```json
{
  "success": true,
  "recordCount": 50,
  "totalTargets": 150,
  "message": "Successfully uploaded 50 records"
}
```

## 문제 해결

### CSV 파일을 찾을 수 없음
- `data/targets.csv` 파일이 프로젝트에 포함되어 있는지 확인
- 파일 경로가 올바른지 확인

### 데이터베이스 연결 오류
- `DATABASE_URL` 환경 변수가 올바르게 설정되어 있는지 확인
- PostgreSQL 데이터베이스가 생성되어 있는지 확인

### 권한 오류 (API 사용 시)
- `ADMIN_TOKEN` 환경 변수가 설정되어 있는지 확인
- Authorization 헤더가 올바른지 확인

