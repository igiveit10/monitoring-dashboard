/**
 * 코멘트 일괄 주입 스크립트
 * 
 * 목적: RunResult.comment 필드에 코멘트를 일괄 주입
 * 
 * 사용법:
 *   로컬: npx tsx scripts/apply-comments.ts
 *   Render: render shell 접속 후 npx tsx scripts/apply-comments.ts
 * 
 * 보안: 이 스크립트는 관리자만 실행해야 하며, 외부 공개 API로 노출되면 안 됨
 */

import { PrismaClient } from '@prisma/client'
import { normalizeRunDate } from '../lib/utils'

// DATABASE_URL 환경변수에서 Prisma 클라이언트 생성
const getPrisma = () => {
  const rawDatabaseUrl = process.env.DATABASE_URL ?? ""
  const databaseUrl = rawDatabaseUrl.replace(/\s/g, "")
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다')
  }
  
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error(`DATABASE_URL이 올바른 형식이 아닙니다: ${databaseUrl}`)
  }
  
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`DATABASE_URL 프로토콜이 postgres가 아닙니다: ${parsed.protocol}`)
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

// 주입할 코멘트 매핑
const COMMENT_MAPPING: Record<string, string> = {
  'd234086916': '제안검색 수정',
  'd1003260531': '다른논문, Seckel 증후군 환자의 전신마취경험 - 증례보고 -',
  'd884485527': '다른논문, HIRA Research의 도약 - 건강보험심사평가원',
  'd181674889': '다른논문, 의과대학생과 전공의를 위한 전문가적 행동규범 도출 - 한국의학교육학회',
  'd1003219782': '다른논문, 상급종합병원 간호사의 연령차별주의와 간호근무환경이 노인간호수행에',
  'd1003258940': '다른논문, 단일 기관에서 교환이식 프로그램을 이용한 배우자간 신장이식 및 부부간',
  'd62118501': '다른논문, 뉴타운사업의 합리적 추진방안 연구 - 국토연구원',
  'd1003253634': '다른논문, 급성기 뇌졸중 환자의 삶의 질에 영향을 미치는 요인 - 대한인지재활학회',
  'd1003248874': '다른논문, 고령화시대 국민건강보험의 발전방향 - 강원대학교 비교법학연구소',
  'd309147771': '다른논문, 고령 운전자를 위한 조건부 운전면허제도 개선방향 연구 - 한국ITS학회',
}

// 적용할 run_date (YYYY-MM-DD 형식)
const TARGET_RUN_DATE = '2025-12-31'

async function main() {
  console.log('[APPLY-COMMENTS] start')
  console.log(`[APPLY-COMMENTS] cwd=${process.cwd()}`)
  console.log(`[APPLY-COMMENTS] DATABASE_URL present=${!!process.env.DATABASE_URL}`)
  console.log(`[APPLY-COMMENTS] Target run_date=${TARGET_RUN_DATE}`)
  console.log(`[APPLY-COMMENTS] Comment mappings=${Object.keys(COMMENT_MAPPING).length} entries`)

  const prisma = getPrisma()

  try {
    // 날짜 정규화
    const normalizedRunDate = normalizeRunDate(TARGET_RUN_DATE)
    console.log(`[APPLY-COMMENTS] Normalized run_date=${normalizedRunDate}`)

    // Run 조회
    const run = await prisma.run.findUnique({
      where: { runDate: normalizedRunDate },
    })

    if (!run) {
      console.error(`[APPLY-COMMENTS] ERROR: Run not found for run_date=${normalizedRunDate}`)
      console.error(`[APPLY-COMMENTS] Please ensure the run exists before applying comments.`)
      process.exit(1)
    }

    console.log(`[APPLY-COMMENTS] Run found: id=${run.id}, runDate=${run.runDate}`)

    let updatedCount = 0
    let skippedCount = 0
    let notFoundCount = 0

    // 각 코멘트 매핑에 대해 업데이트
    for (const [targetId, comment] of Object.entries(COMMENT_MAPPING)) {
      try {
        // Target 존재 확인
        const target = await prisma.target.findUnique({
          where: { id: targetId },
        })

        if (!target) {
          console.warn(`[APPLY-COMMENTS] Target not found: ${targetId}`)
          notFoundCount++
          continue
        }

        // RunResult 조회
        const existingResult = await prisma.runResult.findUnique({
          where: {
            runId_targetId: {
              runId: run.id,
              targetId: target.id,
            },
          },
        })

        if (!existingResult) {
          console.warn(`[APPLY-COMMENTS] RunResult not found: targetId=${targetId}, runDate=${normalizedRunDate}`)
          skippedCount++
          continue
        }

        // 코멘트 업데이트 (빈 문자열이 아닌 경우에만)
        const trimmedComment = comment.trim()
        if (trimmedComment.length === 0) {
          console.warn(`[APPLY-COMMENTS] Skipping empty comment for targetId=${targetId}`)
          skippedCount++
          continue
        }

        await prisma.runResult.update({
          where: {
            runId_targetId: {
              runId: run.id,
              targetId: target.id,
            },
          },
          data: {
            comment: trimmedComment,
          },
        })

        updatedCount++
        console.log(`[APPLY-COMMENTS] Updated: targetId=${targetId}, comment="${trimmedComment.substring(0, 50)}${trimmedComment.length > 50 ? '...' : ''}"`)
      } catch (error: any) {
        console.error(`[APPLY-COMMENTS] Error updating targetId=${targetId}:`, error.message)
        skippedCount++
      }
    }

    // 검증: 업데이트된 코멘트 확인
    console.log(`\n[APPLY-COMMENTS] === Summary ===`)
    console.log(`[APPLY-COMMENTS] Updated: ${updatedCount}`)
    console.log(`[APPLY-COMMENTS] Skipped: ${skippedCount}`)
    console.log(`[APPLY-COMMENTS] Target not found: ${notFoundCount}`)

    // 검증 SQL 출력
    console.log(`\n[APPLY-COMMENTS] === Verification SQL ===`)
    console.log(`-- Check comments for run_date=${normalizedRunDate}:`)
    console.log(`SELECT rr.id, rr."targetId", t.keyword, rr.comment`)
    console.log(`FROM "RunResult" rr`)
    console.log(`JOIN "Run" r ON rr."runId" = r.id`)
    console.log(`JOIN "Target" t ON rr."targetId" = t.id`)
    console.log(`WHERE r."runDate" = '${normalizedRunDate}'`)
    console.log(`  AND rr.comment IS NOT NULL`)
    console.log(`  AND rr.comment != ''`)
    console.log(`ORDER BY t.keyword;`)

    // 실제 검증 쿼리 실행
    const verificationResults = await prisma.runResult.findMany({
      where: {
        runId: run.id,
        comment: {
          not: null,
        },
      },
      include: {
        target: {
          select: {
            id: true,
            keyword: true,
          },
        },
      },
      orderBy: {
        target: {
          keyword: 'asc',
        },
      },
    })

    console.log(`\n[APPLY-COMMENTS] === Verification Results ===`)
    console.log(`[APPLY-COMMENTS] Total RunResults with comments: ${verificationResults.length}`)
    verificationResults.forEach((result) => {
      const commentPreview = result.comment ? result.comment.substring(0, 50) + (result.comment.length > 50 ? '...' : '') : '(null)'
      console.log(`[APPLY-COMMENTS]   - ${result.targetId}: "${commentPreview}"`)
    })

    console.log(`\n[APPLY-COMMENTS] completed successfully`)
  } catch (error) {
    console.error('[APPLY-COMMENTS] Fatal error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error('[APPLY-COMMENTS] Fatal error:', e)
    process.exit(1)
  })

