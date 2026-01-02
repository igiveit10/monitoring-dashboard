import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { normalizeRunDate } from '../../../lib/utils'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// 모니터링 결과 저장/업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { runDate: rawRunDate, targetId, foundAcademicNaver, isPdf, myComment } = body

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

    // Run 조회 또는 생성 (upsert로 race condition 방지)
    const run = await prisma.run.upsert({
      where: { runDate },
      update: {}, // 기존 run이 있으면 업데이트 없음 (runDate만 있으므로)
      create: { runDate },
    })
    console.log(`[Monitoring API] Run upserted: id=${run.id}, runDate=${run.runDate}`)

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
      // update 데이터 준비 (myComment가 undefined면 제외)
      const updateData: any = {
        foundAcademicNaver: foundAcademicNaver ?? false,
        isPdf: isPdf ?? false,
        checkedAt: new Date(),
      }
      
      // myComment가 undefined가 아니면 업데이트에 포함
      if (myComment !== undefined) {
        updateData.myComment = myComment && myComment.trim() !== '' ? myComment.trim() : null
      }
      
      result = await prisma.runResult.upsert({
        where: {
          runId_targetId: {
            runId: run.id,
            targetId,
          },
        },
        update: updateData,
        create: {
          runId: run.id,
          targetId,
          foundAcademicNaver: foundAcademicNaver ?? false,
          isPdf: isPdf ?? false,
          myComment: myComment !== undefined && myComment && myComment.trim() !== '' ? myComment.trim() : null,
        },
      })

      const action = existingResult ? 'updated' : 'created'
      console.log(`[Monitoring API] RunResult ${action}: runId=${run.id}, targetId=${targetId}, foundAcademicNaver=${result.foundAcademicNaver}, isPdf=${result.isPdf}, myComment=${result.myComment || '(empty)'}, resultId=${result.id}`)
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

