// 작업 후 이 파일 삭제
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { normalizeRunDate } from '../../../../lib/utils'

export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest) {
  const prisma = getPrisma()
  
  try {
    // 인증 체크
    const adminToken = request.headers.get('x-admin-token')
    const expectedToken = process.env.ADMIN_TOKEN
    
    if (!adminToken || adminToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const normalizedRunDate = normalizeRunDate(TARGET_RUN_DATE)
    
    // Run 조회
    const run = await prisma.run.findUnique({
      where: { runDate: normalizedRunDate },
    })

    if (!run) {
      return NextResponse.json(
        { error: `Run not found for runDate=${normalizedRunDate}` },
        { status: 404 }
      )
    }

    let totalUpdated = 0
    const updateResults: Array<{ targetId: string; updated: number }> = []

    // 각 targetId별로 updateMany 실행
    for (const [targetId, comment] of Object.entries(COMMENT_MAPPING)) {
      const trimmedComment = comment.trim()
      
      if (trimmedComment.length === 0) {
        continue
      }

      const result = await prisma.runResult.updateMany({
        where: {
          runId: run.id,
          targetId: targetId,
        },
        data: {
          comment: trimmedComment,
        },
      })

      if (result.count > 0) {
        totalUpdated += result.count
        updateResults.push({ targetId, updated: result.count })
      }
    }

    await prisma.$disconnect()

    return NextResponse.json({
      success: true,
      runDate: normalizedRunDate,
      totalUpdated,
      details: updateResults,
    })
  } catch (error) {
    await prisma.$disconnect()
    console.error('[APPLY-COMMENTS] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to apply comments',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

