import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { runDate: 'desc' },
      include: {
        _count: {
          select: { results: true },
        },
      },
    })
    return NextResponse.json(runs)
  } catch (error) {
    console.error('Error fetching runs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch runs' },
      { status: 500 }
    )
  }
}

