import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const targets = await prisma.target.findMany({
      orderBy: { createdAt: 'asc' },
    })

    const runResults = await prisma.runResult.findMany({
      orderBy: { runDate: 'desc' },
    })

    // Group run results by date
    const runResultsByDate: Record<string, typeof runResults> = {}
    const runDates = new Set<string>()

    runResults.forEach(result => {
      const dateStr = result.runDate.toISOString().split('T')[0]
      if (!runResultsByDate[dateStr]) {
        runResultsByDate[dateStr] = []
      }
      runResultsByDate[dateStr].push(result)
      runDates.add(dateStr)
    })

    return NextResponse.json({
      targets,
      runResults: runResultsByDate,
      runDates: Array.from(runDates).sort().reverse(),
    })
  } catch (error) {
    console.error('[Dashboard API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load data', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

