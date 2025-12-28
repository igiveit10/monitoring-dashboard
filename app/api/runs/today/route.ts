import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayDateString } from '@/lib/utils'
import { checkUrlsWithConcurrency } from '@/lib/checker'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const today = getTodayDateString()

    // 오늘 Run이 이미 있는지 확인
    let run = await prisma.run.findUnique({
      where: { runDate: today },
    })

    if (!run) {
      // 새 Run 생성
      run = await prisma.run.create({
        data: { runDate: today },
      })
    }

    // 모든 targets 가져오기
    const targets = await prisma.target.findMany()

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        runId: run.id,
        message: 'No targets to check',
        checkedCount: 0,
      })
    }

    // 체크 실행 (동시성 5)
    const checkData = targets.map((t) => ({ id: t.id, url: t.url }))
    const results = await checkUrlsWithConcurrency(checkData, 5)

    // 결과 저장
    let checkedCount = 0
    for (const [targetId, checkResult] of results.entries()) {
      try {
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
      } catch (error) {
        console.error(`Error saving result for target ${targetId}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      runDate: today,
      checkedCount,
      totalTargets: targets.length,
    })
  } catch (error) {
    console.error('Error running today check:', error)
    return NextResponse.json(
      { error: 'Failed to run today check' },
      { status: 500 }
    )
  }
}

