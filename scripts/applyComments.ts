/**
 * 코멘트 일괄 적용 스크립트
 * 
 * 목적: RunResult.comment 필드에 코멘트를 일괄 업데이트
 * 실행: Render Shell에서 npx tsx scripts/applyComments.ts
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

// 주입할 코멘트 매핑 (targetId -> comment)
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

const TARGET_RUN_DATE = '2025-12-31'

async function main() {
  console.log('[APPLY-COMMENTS] Starting...')
  console.log(`[APPLY-COMMENTS] Target runDate: ${TARGET_RUN_DATE}`)
  console.log(`[APPLY-COMMENTS] Comment mappings: ${Object.keys(COMMENT_MAPPING).length} entries`)

  const prisma = getPrisma()

  try {
    const normalizedRunDate = normalizeRunDate(TARGET_RUN_DATE)
    console.log(`[APPLY-COMMENTS] Normalized runDate: ${normalizedRunDate}`)

    // Run 조회
    const run = await prisma.run.findUnique({
      where: { runDate: normalizedRunDate },
    })

    if (!run) {
      console.error(`[APPLY-COMMENTS] ERROR: Run not found for runDate=${normalizedRunDate}`)
      process.exit(1)
    }

    console.log(`[APPLY-COMMENTS] Run found: id=${run.id}`)

    let updatedCount = 0
    let notFoundCount = 0

    // Transaction으로 일괄 업데이트
    await prisma.$transaction(async (tx) => {
      for (const [targetId, comment] of Object.entries(COMMENT_MAPPING)) {
        const trimmedComment = comment.trim()
        
        if (trimmedComment.length === 0) {
          console.warn(`[APPLY-COMMENTS] Skipping empty comment for targetId=${targetId}`)
          continue
        }

        // RunResult 업데이트
        const result = await tx.runResult.updateMany({
          where: {
            runId: run.id,
            targetId: targetId,
          },
          data: {
            comment: trimmedComment,
          },
        })

        if (result.count > 0) {
          updatedCount++
          console.log(`[APPLY-COMMENTS] Updated targetId=${targetId}: "${trimmedComment.substring(0, 50)}${trimmedComment.length > 50 ? '...' : ''}"`)
        } else {
          notFoundCount++
          console.warn(`[APPLY-COMMENTS] RunResult not found: targetId=${targetId}, runDate=${normalizedRunDate}`)
        }
      }
    })

    console.log(`\n[APPLY-COMMENTS] === Summary ===`)
    console.log(`[APPLY-COMMENTS] Updated: ${updatedCount}`)
    console.log(`[APPLY-COMMENTS] Not found: ${notFoundCount}`)
    console.log(`[APPLY-COMMENTS] Total processed: ${Object.keys(COMMENT_MAPPING).length}`)
    console.log(`[APPLY-COMMENTS] Completed successfully`)

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

