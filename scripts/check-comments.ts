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
    // Target.note 확인
    console.log(`\n[CHECK-COMMENTS] === Target.note 확인 ===`)
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
        note: true,
      },
    })

    const total = targets.length
    const nullCnt = targets.filter(t => t.note === null).length
    const emptyCnt = targets.filter(t => t.note === '').length
    const filledCnt = targets.filter(t => t.note !== null && t.note !== '').length

    console.log(`[CHECK-COMMENTS] Total: ${total}`)
    console.log(`[CHECK-COMMENTS] NULL: ${nullCnt}`)
    console.log(`[CHECK-COMMENTS] Empty string: ${emptyCnt}`)
    console.log(`[CHECK-COMMENTS] Filled: ${filledCnt}`)

    console.log(`\n[CHECK-COMMENTS] Found ${targets.length} targets:`)
    targets.forEach(t => {
      console.log(`[CHECK-COMMENTS]   - ${t.id}: note="${t.note || '(null/empty)'}"`)
    })

    // SQL 쿼리 출력 (참고용)
    console.log(`\n[CHECK-COMMENTS] === 참고: SQL 쿼리 ===`)
    console.log(`-- Target.note 확인`)
    console.log(`SELECT id, keyword, note`)
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

