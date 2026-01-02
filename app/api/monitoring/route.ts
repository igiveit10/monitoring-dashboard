import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { normalizeRunDate } from '../../../lib/utils'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// 모니터링 결과 저장/업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { runDate: rawRunDate, targetId, foundAcademicNaver, isPdf, note } = body

    if (!rawRunDate || !targetId) {
      console.error('[Monitoring API] Missing required fields:', { runDate: rawRunDate, targetId })
      return NextResponse.json(
        { error: 'runDate and targetId are required' },
        { status: 400 }
      )
    }

    // 날짜 정규화: YYYY-MM-DD 형식으로 통일
    const runDate = normalizeRunDate(rawRunDate)
    console.log(`[Monitoring API] Request received: runDate=${rawRunDate} (normalized=${runDate}), targetId=${targetId}`)

    // Run 조회 또는 생성
    let run = await prisma.run.findFirst({
      where: { runDate },
    })

    if (!run) {
      run = await prisma.run.create({
        data: { runDate },
      })
      console.log(`[Monitoring API] Run created: id=${run.id}, runDate=${run.runDate}`)
    } else {
      console.log(`[Monitoring API] Run found: id=${run.id}, runDate=${run.runDate}`)
    }

    // RunResult 업데이트 또는 생성
    const existingResult = await prisma.runResult.findUnique({
      where: {
        runId_targetId: {
          runId: run.id,
          targetId,
        },
      },
    })

    let result
    try {
      result = await prisma.runResult.upsert({
        where: {
          runId_targetId: {
            runId: run.id,
            targetId,
          },
        },
        update: {
          foundAcademicNaver: foundAcademicNaver ?? false,
          isPdf: isPdf ?? false,
          checkedAt: new Date(),
        },
        create: {
          runId: run.id,
          targetId,
          foundAcademicNaver: foundAcademicNaver ?? false,
          isPdf: isPdf ?? false,
        },
      })

      const action = existingResult ? 'updated' : 'created'
      console.log(`[Monitoring API] RunResult ${action}: runId=${run.id}, targetId=${targetId}, foundAcademicNaver=${result.foundAcademicNaver}, isPdf=${result.isPdf}, resultId=${result.id}`)
      
      // note 필드 제거됨 (DB에 컬럼 없음) - 업데이트 스킵
    } catch (upsertError: any) {
      console.error(`[Monitoring API] Upsert error for runId=${run.id}, targetId=${targetId}:`, upsertError)
      console.error(`[Monitoring API] Error code: ${upsertError.code}, message: ${upsertError.message}`)
      throw upsertError
    }

    // 저장된 결과 개수 확인
    const resultCount = await prisma.runResult.count({
      where: { runId: run.id },
    })
    console.log(`[Monitoring API] Total results for run ${runDate}: ${resultCount}`)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[Monitoring API] Error saving monitoring result:', error)
    console.error('[Monitoring API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: 'Failed to save monitoring result',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

