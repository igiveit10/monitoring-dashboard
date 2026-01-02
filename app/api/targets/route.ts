import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const targets = await prisma.target.findMany({
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
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(targets)
  } catch (error) {
    console.error('Error fetching targets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch targets' },
      { status: 500 }
    )
  }
}

