# 모니터링 대시보드 v2

최소 기능 버전의 모니터링 대시보드입니다.

## 기능

- Target 목록 표시 (정답셋 정보 포함)
- 날짜별 모니터링 결과 입력 및 저장
- CSV 업로드를 통한 Target 관리

## Render 배포 설정

### 환경 변수

- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열

### 빌드 명령

```
npm install && npm run build
```

### 시작 명령

```
npm start
```

시작 전에 `prisma migrate deploy`가 자동으로 실행됩니다.

## 로컬 개발

1. 환경 변수 설정 (`.env` 파일):
   ```
   DATABASE_URL="postgresql://..."
   ```

2. 데이터베이스 마이그레이션:
   ```bash
   npx prisma migrate dev
   ```

3. 개발 서버 실행:
   ```bash
   npm run dev
   ```

4. 브라우저에서 `http://localhost:3000/v2` 접속

## 데이터베이스 스키마

- `Target`: 타겟 정보 (id, title, url, expectedSearch, expectedPdf, note)
- `RunResult`: 모니터링 결과 (id, runDate, targetId, foundSearch, foundPdf, isDone)

## CSV 업로드 형식

CSV 파일은 다음 컬럼을 포함해야 합니다:
- `id`: Target ID (필수)
- `title`: 제목 (필수)
- `url`: URL (필수)
- `expectedSearch`: 예상 검색 노출 (Y/N 또는 true/false)
- `expectedPdf`: 예상 PDF 노출 (Y/N 또는 true/false)
- `note`: 비고 (선택)

