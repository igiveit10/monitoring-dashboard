import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { checkUrl } from '../../../../lib/checker'
import { getTodayDateString } from '../../../../lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const targetId = params.targetId
    const { runDate } = await request.json().catch(() => ({}))
    const checkDate = runDate || getTodayDateString()

    // Target 조회
    const target = await prisma.target.findUnique({
      where: { id: targetId },
    })

    if (!target) {
      return NextResponse.json(
        { error: 'Target not found' },
        { status: 404 }
      )
    }

    // Run 조회 또는 생성
    let run = await prisma.run.findUnique({
      where: { runDate: checkDate },
    })

    if (!run) {
      run = await prisma.run.create({
        data: { runDate: checkDate },
      })
    }

    // URL 체크 실행
    const checkResult = await checkUrl(target.url)

    // 결과 저장
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

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('Error checking target:', error)
    return NextResponse.json(
      { error: 'Failed to check target' },
      { status: 500 }
    )
  }
}

