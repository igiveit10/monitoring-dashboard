import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// 진단 API: DB 상태 확인 (ADMIN_TOKEN 필요)
export async function GET(request: NextRequest) {
  try {
    // ADMIN_TOKEN 검증
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN

    if (!adminToken) {
      return NextResponse.json(
        { error: 'ADMIN_TOKEN not configured' },
        { status: 500 }
      )
    }

    if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Targets 개수
    const targetsCount = await prisma.target.count()

    // Runs 날짜별 개수 요약
    const runs = await prisma.run.findMany({
      include: {
        results: true,
      },
      orderBy: {
        runDate: 'desc',
      },
    })

    const runsSummary = runs.map((run) => ({
      runDate: run.runDate,
      runId: run.id,
      resultsCount: run.results.length,
      createdAt: run.createdAt,
    }))

    // 전체 RunResult 개수
    const totalResultsCount = await prisma.runResult.count()

    return NextResponse.json({
      success: true,
      data: {
        targets: {
          count: targetsCount,
        },
        runs: {
          count: runs.length,
          summary: runsSummary,
        },
        results: {
          count: totalResultsCount,
        },
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Admin Diag API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch diagnostic data',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

