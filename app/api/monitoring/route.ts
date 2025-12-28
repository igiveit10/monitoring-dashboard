import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// 모니터링 결과 저장/업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { runDate, targetId, foundAcademicNaver, isPdf, comment } = body

    if (!runDate || !targetId) {
      return NextResponse.json(
        { error: 'runDate and targetId are required' },
        { status: 400 }
      )
    }

    // Run 조회 또는 생성
    let run = await prisma.run.findUnique({
      where: { runDate },
    })

    if (!run) {
      run = await prisma.run.create({
        data: { runDate },
      })
    }

    // RunResult 업데이트 또는 생성
    const result = await prisma.runResult.upsert({
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

    // Target의 비고 업데이트 (comment가 제공된 경우)
    // 비고는 참고용 텍스트일 뿐이며, 정답셋의 PDF 노출과는 무관
    if (comment !== undefined) {
      await prisma.target.update({
        where: { id: targetId },
        data: { myComment: comment || null },
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Error saving monitoring result:', error)
    return NextResponse.json(
      { error: 'Failed to save monitoring result' },
      { status: 500 }
    )
  }
}

