import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { checkUrl } from '../../../../lib/checker'
import { getTodayDateString, normalizeRunDate } from '../../../../lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const targetId = params.targetId
    const { runDate: rawRunDate } = await request.json().catch(() => ({}))
    
    // 날짜 정규화: YYYY-MM-DD 형식으로 통일
    const checkDate = rawRunDate ? normalizeRunDate(rawRunDate) : getTodayDateString()
    
    if (rawRunDate && rawRunDate !== checkDate) {
      console.log(`[Check API] RunDate normalized: ${rawRunDate} -> ${checkDate}`)
    }
    
    console.log(`[Check API] Request received: targetId=${targetId}, checkDate=${checkDate}`)

    // Target 조회
    const target = await prisma.target.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        keyword: true,
        url: true,
        currentStatus: true,
        csvPdfExposure: true,
        createdAt: true,
        updatedAt: true,
        // note 필드 제외 (DB에 컬럼 없음)
      },
    })

    if (!target) {
      console.error(`[Check API] Target not found: targetId=${targetId}`)
      return NextResponse.json(
        { error: 'Target not found' },
        { status: 404 }
      )
    }

    // Run 조회 또는 생성 (upsert로 race condition 방지)
    const run = await prisma.run.upsert({
      where: { runDate: checkDate },
      update: {}, // 기존 run이 있으면 업데이트 없음 (runDate만 있으므로)
      create: { runDate: checkDate },
    })
    console.log(`[Check API] Run upserted: id=${run.id}, runDate=${run.runDate}`)

    // URL 체크 실행
    const checkResult = await checkUrl(target.url)
    console.log(`[Check API] Check result: foundAcademicNaver=${checkResult.foundAcademicNaver}, isPdf=${checkResult.isPdf}`)

    // 결과 저장
    const existingResult = await prisma.runResult.findUnique({
      where: {
        runId_targetId: {
          runId: run.id,
          targetId: target.id,
        },
      },
    })

    const result = await prisma.runResult.upsert({
      where: {
        runId_targetId: {
          runId: run.id,
          targetId: target.id,
        },
      },
      update: {
        foundAcademicNaver: checkResult.foundAcademicNaver,
        isPdf: checkResult.isPdf,
        httpStatus: checkResult.httpStatus,
        finalUrl: checkResult.finalUrl,
        errorMessage: checkResult.errorMessage,
        checkedAt: new Date(),
      },
      create: {
        runId: run.id,
        targetId: target.id,
        foundAcademicNaver: checkResult.foundAcademicNaver,
        isPdf: checkResult.isPdf,
        httpStatus: checkResult.httpStatus,
        finalUrl: checkResult.finalUrl,
        errorMessage: checkResult.errorMessage,
      },
    })

    const action = existingResult ? 'updated' : 'created'
    console.log(`[Check API] RunResult ${action}: runId=${run.id}, targetId=${targetId}, foundAcademicNaver=${result.foundAcademicNaver}, isPdf=${result.isPdf}`)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('[Check API] Error checking target:', error)
    console.error('[Check API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: 'Failed to check target',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

