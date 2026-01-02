import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const targetId = params.targetId
    const body = await request.json()
    const { note } = body

    // 정답셋 값(currentStatus, csvPdfExposure)은 수정 불가
    // 비고만 수정 가능 (참고용 텍스트)
    const target = await prisma.target.update({
      where: { id: targetId },
      data: {
        note: note !== undefined ? note : undefined,
      },
    })

    return NextResponse.json({ success: true, target })
  } catch (error) {
    console.error('Error updating target:', error)
    return NextResponse.json(
      { error: 'Failed to update target' },
      { status: 500 }
    )
  }
}

