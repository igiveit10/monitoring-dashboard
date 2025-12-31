import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const getPrisma = () => {
  const rawDatabaseUrl = process.env.DATABASE_URL ?? ""
  const databaseUrl = rawDatabaseUrl.replace(/\s/g, "")
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다')
  }
  
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error(`DATABASE_URL이 올바른 형식이 아닙니다: ${databaseUrl}`)
  }
  
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`DATABASE_URL 프로토콜이 postgres가 아닙니다: ${parsed.protocol}`)
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

export async function POST(request: NextRequest) {
  // 인증 확인
  const authHeader = request.headers.get('authorization')
  const adminToken = process.env.ADMIN_TOKEN
  
  if (!adminToken) {
    return NextResponse.json(
      { error: 'ADMIN_TOKEN이 설정되지 않았습니다' },
      { status: 500 }
    )
  }

  if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const prisma = getPrisma()

  try {
    console.log('Admin seed endpoint called')

    // CSV 파일 경로 확인
    const possiblePaths = [
      join(process.cwd(), 'data', 'targets.csv'),
      join(process.cwd(), 'scripts', 'targets.csv'),
      join(process.cwd(), 'sample.csv'),
    ]

    let csvPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        csvPath = path
        console.log(`Found CSV file at: ${path}`)
        break
      }
    }

    if (!csvPath) {
      return NextResponse.json(
        { error: 'CSV file not found. Please ensure data/targets.csv exists.' },
        { status: 404 }
      )
    }

    // CSV 파일 읽기
    let content = readFileSync(csvPath, 'utf-8')
    
    // BOM 제거
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1)
    }

    // CSV 파싱
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    console.log(`Parsed ${records.length} records from CSV`)

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    // 각 레코드를 upsert
    for (const record of records) {
      let keyword: string | undefined
      let url: string | undefined
      let currentStatus: string | null = null
      let myComment: string | null = null
      let csvId: string | undefined = undefined
      let csvPdfExposure: boolean | undefined = undefined

      csvId = record.id || record._id || undefined
      keyword = record.keyword || record.title || undefined

      if (record.keyword && record.url) {
        url = record.url
        currentStatus = record.currentStatus || null
        myComment = record.myComment || null
        csvPdfExposure = record.csvPdfExposure === 'Y' || record.csvPdfExposure === true
      } else if (record.title && record.통검url3) {
        url = record.통검url3
        if (record.통검노출 === 'Y') {
          currentStatus = '노출'
        } else if (record.통검노출 === 'N') {
          currentStatus = '미노출'
        }
        csvPdfExposure = record['PDF 노출'] === 'Y'
        myComment = record.비고 || null
      } else if (keyword && record.url) {
        url = record.url
        currentStatus = record.currentStatus || null
        myComment = record.myComment || null
        csvPdfExposure = record.csvPdfExposure === 'Y' || record.csvPdfExposure === true
      }

      if (!keyword || !url) {
        skippedCount++
        continue
      }

      let existing: any = null

      if (csvId) {
        try {
          existing = await prisma.target.findUnique({
            where: { id: csvId },
          })
        } catch (e) {
          // ID 형식이 잘못된 경우 무시
        }
      }

      if (!existing && url) {
        existing = await prisma.target.findUnique({
          where: { url },
        })
      }

      if (existing) {
        const updateData: any = {
          keyword,
          updatedAt: new Date(),
        }
        
        if (currentStatus !== null) updateData.currentStatus = currentStatus
        if (csvPdfExposure !== undefined) updateData.csvPdfExposure = csvPdfExposure
        if (myComment !== null) updateData.myComment = myComment
        if (url && url !== existing.url) {
          const urlExists = await prisma.target.findUnique({
            where: { url },
          })
          if (!urlExists) {
            updateData.url = url
          }
        }

        await prisma.target.update({
          where: { id: existing.id },
          data: updateData,
        })
        updatedCount++
      } else {
        try {
          await prisma.target.create({
            data: {
              ...(csvId ? { id: csvId } : {}),
              keyword,
              url,
              currentStatus,
              csvPdfExposure: csvPdfExposure ?? false,
              myComment,
            },
          })
          createdCount++
        } catch (error: any) {
          if (error.code === 'P2002' && csvId) {
            await prisma.target.create({
              data: {
                keyword,
                url,
                currentStatus,
                csvPdfExposure: csvPdfExposure ?? false,
                myComment,
              },
            })
            createdCount++
          } else {
            console.error(`Error creating target ${keyword}:`, error.message)
            skippedCount++
          }
        }
      }
    }

    const totalCount = await prisma.target.count()

    return NextResponse.json({
      success: true,
      message: 'Seeding completed',
      stats: {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: totalCount,
      },
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return NextResponse.json(
      { 
        error: 'Failed to seed database',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

