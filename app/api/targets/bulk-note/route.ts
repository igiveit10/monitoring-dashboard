import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// Target.note 일괄 업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { noteUpdates } = body

    if (!Array.isArray(noteUpdates)) {
      return NextResponse.json(
        { error: 'noteUpdates must be an array' },
        { status: 400 }
      )
    }

    console.log(`[Bulk Note API] Received ${noteUpdates.length} note updates`)

    // 트랜잭션으로 일괄 업데이트
    const results = await prisma.$transaction(
      noteUpdates.map(({ targetId, note }: { targetId: string; note: string }) =>
        prisma.target.update({
          where: { id: targetId },
          data: {
            note: note && note.trim() !== '' ? note.trim() : null,
          },
        })
      )
    )

    console.log(`[Bulk Note API] Successfully updated ${results.length} targets`)

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
    })
  } catch (error) {
    console.error('[Bulk Note API] Error updating notes:', error)
    return NextResponse.json(
      {
        error: 'Failed to update notes',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

