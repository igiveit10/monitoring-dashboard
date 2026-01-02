import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getTodayDateString, sortTargetsByAnswerSet, normalizeRunDate } from '../../../../lib/utils'
import { checkUrlsWithConcurrency } from '../../../../lib/checker'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const today = normalizeRunDate(getTodayDateString())
    console.log(`[Runs/Today API] Request received: runDate=${today}`)

    // 오늘 Run이 이미 있는지 확인
    let run = await prisma.run.findUnique({
      where: { runDate: today },
    })

    if (!run) {
      // 새 Run 생성
      run = await prisma.run.create({
        data: { runDate: today },
      })
      console.log(`[Runs/Today API] Run created: id=${run.id}, runDate=${run.runDate}`)
    } else {
      console.log(`[Runs/Today API] Run found: id=${run.id}, runDate=${run.runDate}`)
    }

    // 모든 targets 가져오기
    const targetsRaw = await prisma.target.findMany({
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
    // 정답셋 기준으로 정렬: YY > YN > NY > NN (모니터링 실행 순서)
    const targets = sortTargetsByAnswerSet(targetsRaw)
    console.log(`[Runs/Today API] Fetched ${targets.length} targets (sorted by answer set: YY > YN > NY > NN)`)

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        runId: run.id,
        message: 'No targets to check',
        checkedCount: 0,
      })
    }

    // 체크 실행 (동시성 5) - 정렬된 순서대로 처리됨
    const checkData = targets.map((t) => ({ id: t.id, url: t.url }))
    const results = await checkUrlsWithConcurrency(checkData, 5)
    console.log(`[Runs/Today API] Check completed: ${results.size} results`)

    // 결과 저장
    let checkedCount = 0
    let updatedCount = 0
    let createdCount = 0
    let errorCount = 0
    
    for (const [targetId, checkResult] of results.entries()) {
      try {
        const existingResult = await prisma.runResult.findUnique({
          where: {
            runId_targetId: {
              runId: run.id,
              targetId,
            },
          },
        })

        await prisma.runResult.upsert({
          where: {
            runId_targetId: {
              runId: run.id,
              targetId,
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
            targetId,
            foundAcademicNaver: checkResult.foundAcademicNaver,
            isPdf: checkResult.isPdf,
            httpStatus: checkResult.httpStatus,
            finalUrl: checkResult.finalUrl,
            errorMessage: checkResult.errorMessage,
          },
        })
        
        checkedCount++
        if (existingResult) {
          updatedCount++
        } else {
          createdCount++
        }
      } catch (error) {
        errorCount++
        console.error(`[Runs/Today API] Error saving result for target ${targetId}:`, error)
        console.error(`[Runs/Today API] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
      }
    }

    // 저장된 결과 개수 확인
    const resultCount = await prisma.runResult.count({
      where: { runId: run.id },
    })
    console.log(`[Runs/Today API] Results saved: created=${createdCount}, updated=${updatedCount}, errors=${errorCount}, total in DB=${resultCount}`)

    return NextResponse.json({
      success: true,
      runId: run.id,
      runDate: today,
      checkedCount,
      totalTargets: targets.length,
    })
  } catch (error) {
    console.error('[Runs/Today API] Error running today check:', error)
    console.error('[Runs/Today API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: 'Failed to run today check',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

