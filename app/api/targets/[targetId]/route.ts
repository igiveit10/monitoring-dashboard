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

    // note 필드 제거됨 (DB에 컬럼 없음) - 업데이트 스킵
    // 정답셋 값(currentStatus, csvPdfExposure)은 수정 불가
    const target = await prisma.target.findUnique({
      where: { id: targetId },
    })
    
    if (!target) {
      return NextResponse.json(
        { error: 'Target not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, target })
  } catch (error) {
    console.error('Error updating target:', error)
    return NextResponse.json(
      { error: 'Failed to update target' },
      { status: 500 }
    )
  }
}

