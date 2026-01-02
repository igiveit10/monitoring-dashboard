import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { runDate, runResults, noteUpdates } = body

    if (!runDate || !Array.isArray(runResults)) {
      return NextResponse.json(
        { error: 'runDate and runResults are required' },
        { status: 400 }
      )
    }

    const date = new Date(runDate)
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid runDate format' },
        { status: 400 }
      )
    }

    // Upsert run results
    await prisma.$transaction(
      runResults.map((result: any) =>
        prisma.runResult.upsert({
          where: {
            runDate_targetId: {
              runDate: date,
              targetId: result.targetId,
            },
          },
          update: {
            foundSearch: result.foundSearch ?? false,
            foundPdf: result.foundPdf ?? false,
            isDone: result.isDone ?? false,
            checkedAt: new Date(),
          },
          create: {
            runDate: date,
            targetId: result.targetId,
            foundSearch: result.foundSearch ?? false,
            foundPdf: result.foundPdf ?? false,
            isDone: result.isDone ?? false,
          },
        })
      )
    )

    // Update notes if provided
    if (Array.isArray(noteUpdates) && noteUpdates.length > 0) {
      await prisma.$transaction(
        noteUpdates.map((update: { targetId: string; note: string }) =>
          prisma.target.update({
            where: { id: update.targetId },
            data: {
              note: update.note && update.note.trim() !== '' ? update.note.trim() : null,
            },
          })
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Monitoring API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

