# 배포 가이드

이 프로젝트를 외부에서 접속 가능하도록 배포하는 방법을 안내합니다.

## 배포 옵션

### 1. Railway (추천) ⭐

**장점:**
- SQLite와 파일 시스템 완벽 지원
- 간단한 배포 프로세스
- 무료 플랜 제공 ($5 크레딧/월)
- 자동 HTTPS
- GitHub 연동 가능

**단점:**
- 무료 플랜은 제한적

**배포 방법:**

1. [Railway](https://railway.app)에 가입
2. "New Project" → "Deploy from GitHub repo" 선택
3. GitHub 저장소 연결
4. 자동으로 배포 시작
5. 환경 변수 설정:
   - `DATABASE_URL`: Railway가 자동으로 설정 (또는 수동 설정)
6. 배포 완료 후 URL 확인

**환경 변수:**
```
DATABASE_URL=file:./data/app.db
```

**주의사항:**
- Railway는 영구 볼륨을 지원하므로 `data/` 폴더가 유지됩니다
- 무료 플랜은 일정 시간 후 슬립 모드로 전환될 수 있습니다

---

### 2. Render

**장점:**
- 무료 플랜 제공
- 파일 시스템 지원
- PostgreSQL 지원 (마이그레이션 가능)

**단점:**
- 무료 플랜은 슬립 모드 있음

**배포 방법:**

1. [Render](https://render.com)에 가입
2. "New Web Service" 선택
3. GitHub 저장소 연결
4. 설정:
   - Build Command: `npm install && npm run db:generate && npm run build`
   - Start Command: `npm start`
5. 환경 변수 설정
6. 배포

---

### 3. Fly.io

**장점:**
- 전 세계 엣지 배포
- 파일 시스템 지원
- 무료 플랜 제공

**단점:**
- 설정이 다소 복잡

**배포 방법:**

1. [Fly.io](https://fly.io)에 가입
2. `flyctl` 설치
3. `fly launch` 실행
4. 설정 파일 자동 생성 후 배포

---

### 4. Vercel (PostgreSQL 필요)

**장점:**
- Next.js 최적화
- 매우 빠른 배포
- 무료 플랜 제공

**단점:**
- SQLite 미지원 (PostgreSQL로 마이그레이션 필요)
- 파일 시스템 제한 (Vercel KV 또는 외부 스토리지 필요)

**PostgreSQL 마이그레이션 필요:**
- Prisma 스키마를 PostgreSQL로 변경
- Vercel Postgres 사용
- 파일 업로드는 Vercel Blob 또는 S3 사용

---

## 배포 전 준비사항

### 1. 환경 변수 확인

`.env` 파일이 `.gitignore`에 포함되어 있는지 확인:
```
DATABASE_URL=file:./data/app.db
```

### 2. 빌드 테스트

로컬에서 빌드가 성공하는지 확인:
```bash
npm run build
npm start
```

### 3. 데이터 백업

배포 전 현재 데이터를 백업:
```bash
# data 폴더 전체 백업
cp -r data data-backup
```

---

## Railway 배포 상세 가이드

### Step 1: GitHub에 푸시

```bash
git add .
git commit -m "배포 준비"
git push origin main
```

### Step 2: Railway 설정

1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. 저장소 선택
4. 자동 배포 시작

### Step 3: 환경 변수 설정

Railway 대시보드 → Variables 탭:
```
DATABASE_URL=file:./data/app.db
NODE_ENV=production
```

### Step 4: 볼륨 설정 (데이터 영구 저장) ⚠️ 중요

1. Railway 대시보드 → Volumes 탭
2. "Create Volume" 클릭
3. Mount Path: `/app/data` (또는 프로젝트 루트 기준 `./data`)
4. 생성 후 서비스에 연결

**⚠️ 중요:** 볼륨을 마운트하지 않으면 데이터가 영구 저장되지 않습니다!

### Step 5: 도메인 설정 (선택)

1. Settings → Domains
2. "Generate Domain" 클릭 (예: `your-app.up.railway.app`)
3. 또는 커스텀 도메인 추가

---

## Render 배포 상세 가이드

### Step 1: GitHub에 푸시

```bash
git add .
git commit -m "배포 준비"
git push origin main
```

### Step 2: Render 설정

1. Render 대시보드에서 "New +" → "Web Service" 선택
2. GitHub 저장소 연결
3. 설정:
   - **Name**: 원하는 서비스 이름
   - **Region**: 가장 가까운 지역 선택
   - **Branch**: `main` (또는 기본 브랜치)
   - **Root Directory**: (비워두기)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run db:generate && npm run build`
   - **Start Command**: `npm start`
4. "Advanced" → "Add Disk" 클릭
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1GB (필요에 따라 조정)

### Step 3: 환경 변수 설정

Render 대시보드 → Environment:
```
DATABASE_URL=file:/opt/render/project/src/data/app.db
NODE_ENV=production
```

### Step 4: 배포

"Create Web Service" 클릭하여 배포 시작

---

## 배포 후 확인사항

1. ✅ 애플리케이션이 정상적으로 시작되는가?
2. ✅ 데이터베이스가 생성되는가?
3. ✅ 파일 업로드가 작동하는가?
4. ✅ URL 체크 기능이 작동하는가?
5. ✅ HTTPS가 활성화되어 있는가?

---

## 문제 해결

### 데이터가 사라지는 경우
- 볼륨이 제대로 마운트되었는지 확인
- 환경 변수 `DATABASE_URL` 경로 확인
- 배포 플랫폼의 영구 스토리지 설정 확인

### 빌드 실패
- `package.json`의 빌드 스크립트 확인
- Prisma 클라이언트 생성 확인 (`npm run db:generate`)
- 로그 확인하여 구체적인 에러 메시지 확인

### 파일 업로드 실패
- `data/uploads/` 폴더 권한 확인
- 볼륨 마운트 경로 확인
- 디스크 공간 확인

### 502 Bad Gateway 에러
- 애플리케이션이 정상적으로 시작되었는지 확인
- 포트 설정 확인 (Next.js는 기본 3000번 포트)
- 로그 확인

---

## 보안 고려사항

1. **환경 변수 보호**: 민감한 정보는 환경 변수로 관리
2. **HTTPS 사용**: 모든 배포 플랫폼이 자동 HTTPS 제공
3. **접근 제어**: 필요시 인증 추가 (NextAuth.js 등)
4. **Rate Limiting**: API 엔드포인트에 rate limiting 추가 고려
5. **CORS 설정**: 필요시 CORS 정책 설정

---

## 비용 비교

| 플랫폼 | 무료 플랜 | 유료 시작 | 특징 |
|--------|----------|----------|------|
| Railway | $5 크레딧/월 | $5/월 | SQLite 지원, 간단 |
| Render | 무료 | $7/월 | PostgreSQL, 슬립 모드 |
| Fly.io | 무료 | $1.94/월 | 엣지 배포, 빠름 |
| Vercel | 무료 | $20/월 | Next.js 최적화 |

---

## 추천 배포 순서

1. **Railway** (가장 간단, SQLite 지원) ⭐
2. **Render** (무료, 안정적)
3. **Fly.io** (전 세계 배포 필요시)

각 플랫폼의 상세 설정은 해당 플랫폼 문서를 참조하세요.

---

## 빠른 시작 (Railway)

```bash
# 1. GitHub에 푸시
git add .
git commit -m "배포 준비"
git push origin main

# 2. Railway에서:
# - New Project → Deploy from GitHub
# - 저장소 선택
# - Variables: DATABASE_URL=file:./data/app.db
# - Volumes: /app/data 마운트
# - 배포 완료!
```

배포된 URL을 공유하면 어디서든 접속 가능합니다! 🚀
