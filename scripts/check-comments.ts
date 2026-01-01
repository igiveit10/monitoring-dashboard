/**
 * 코멘트 현황 확인 스크립트
 * 
 * 목적: DB에 저장된 코멘트 현황을 확인
 */

import { PrismaClient } from '@prisma/client'
import { normalizeRunDate } from '../lib/utils'

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

async function main() {
  console.log('[CHECK-COMMENTS] start')
  console.log(`[CHECK-COMMENTS] cwd=${process.cwd()}`)
  console.log(`[CHECK-COMMENTS] DATABASE_URL present=${!!process.env.DATABASE_URL}`)

  const prisma = getPrisma()
  const targetRunDate = '2025-12-31'
  const normalizedRunDate = normalizeRunDate(targetRunDate)

  try {
    // 1) RunResult의 comment 현황 확인
    console.log(`\n[CHECK-COMMENTS] === 1) RunResult comment 현황 (runDate=${normalizedRunDate}) ===`)
    
    const run = await prisma.run.findUnique({
      where: { runDate: normalizedRunDate },
    })

    if (!run) {
      console.log(`[CHECK-COMMENTS] Run not found for runDate=${normalizedRunDate}`)
    } else {
      const allResults = await prisma.runResult.findMany({
        where: { runId: run.id },
        select: {
          id: true,
          targetId: true,
          comment: true,
        },
      })

      const total = allResults.length
      const nullCnt = allResults.filter(r => r.comment === null).length
      const emptyCnt = allResults.filter(r => r.comment === '').length
      const filledCnt = allResults.filter(r => r.comment !== null && r.comment !== '').length

      console.log(`[CHECK-COMMENTS] Total: ${total}`)
      console.log(`[CHECK-COMMENTS] NULL: ${nullCnt}`)
      console.log(`[CHECK-COMMENTS] Empty string: ${emptyCnt}`)
      console.log(`[CHECK-COMMENTS] Filled: ${filledCnt}`)
    }

    // 2) 특정 id 확인
    console.log(`\n[CHECK-COMMENTS] === 2) 특정 targetId 확인 ===`)
    const targetIds = ['d234086916', 'd1003260531', 'd884485527', 'd181674889']
    
    if (run) {
      for (const targetId of targetIds) {
        const result = await prisma.runResult.findUnique({
          where: {
            runId_targetId: {
              runId: run.id,
              targetId: targetId,
            },
          },
          include: {
            target: {
              select: {
                id: true,
                keyword: true,
                myComment: true,
              },
            },
          },
        })

        if (result) {
          console.log(`[CHECK-COMMENTS] targetId=${targetId}:`)
          console.log(`[CHECK-COMMENTS]   - RunResult.comment: ${result.comment || '(null/empty)'}`)
          console.log(`[CHECK-COMMENTS]   - Target.myComment: ${result.target.myComment || '(null/empty)'}`)
          console.log(`[CHECK-COMMENTS]   - Target.keyword: ${result.target.keyword}`)
        } else {
          console.log(`[CHECK-COMMENTS] targetId=${targetId}: RunResult not found`)
        }
      }
    }

    // 3) Target.note 확인
    console.log(`\n[CHECK-COMMENTS] === 3) Target.myComment 확인 ===`)
    const checkTargetIds = [
      'd234086916', 'd1003260531', 'd884485527', 'd181674889',
      'd1003219782', 'd1003258940', 'd62118501', 'd1003253634',
      'd1003248874', 'd309147771'
    ]

    const targets = await prisma.target.findMany({
      where: {
        id: { in: checkTargetIds },
      },
      select: {
        id: true,
        keyword: true,
        myComment: true,
      },
    })

    console.log(`[CHECK-COMMENTS] Found ${targets.length} targets:`)
    targets.forEach(t => {
      console.log(`[CHECK-COMMENTS]   - ${t.id}: myComment="${t.myComment || '(null/empty)'}"`)
    })

    // SQL 쿼리 출력 (참고용)
    console.log(`\n[CHECK-COMMENTS] === 참고: SQL 쿼리 ===`)
    console.log(`-- 1) RunResult comment 현황`)
    console.log(`SELECT`)
    console.log(`  COUNT(*) as total,`)
    console.log(`  SUM(CASE WHEN comment IS NULL THEN 1 ELSE 0 END) as null_cnt,`)
    console.log(`  SUM(CASE WHEN comment = '' THEN 1 ELSE 0 END) as empty_cnt,`)
    console.log(`  SUM(CASE WHEN comment IS NOT NULL AND comment <> '' THEN 1 ELSE 0 END) as filled_cnt`)
    console.log(`FROM "RunResult" rr`)
    console.log(`JOIN "Run" r ON rr."runId" = r.id`)
    console.log(`WHERE r."runDate" = '${normalizedRunDate}';`)

    console.log(`\n-- 2) 특정 targetId 확인`)
    console.log(`SELECT rr.*, t.keyword, t."myComment"`)
    console.log(`FROM "RunResult" rr`)
    console.log(`JOIN "Run" r ON rr."runId" = r.id`)
    console.log(`JOIN "Target" t ON rr."targetId" = t.id`)
    console.log(`WHERE r."runDate" = '${normalizedRunDate}'`)
    console.log(`  AND rr."targetId" = 'd234086916';`)

    console.log(`\n-- 3) Target.myComment 확인`)
    console.log(`SELECT id, keyword, "myComment"`)
    console.log(`FROM "Target"`)
    console.log(`WHERE id IN ('${checkTargetIds.join("','")}');`)

    console.log(`\n[CHECK-COMMENTS] completed successfully`)
  } catch (error) {
    console.error('[CHECK-COMMENTS] Fatal error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error('[CHECK-COMMENTS] Fatal error:', e)
    process.exit(1)
  })

