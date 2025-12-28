import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // 파일 저장
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `${Date.now()}-${file.name}`
    const filePath = join(process.cwd(), 'data', 'uploads', fileName)
    await writeFile(filePath, buffer)

    // CSV 파싱
    const content = buffer.toString('utf-8')
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    let recordCount = 0

    // 각 레코드를 upsert
    for (const record of records) {
      const { keyword, url, currentStatus, myComment } = record

      if (!keyword || !url) {
        continue // 필수 필드가 없으면 스킵
      }

      await prisma.target.upsert({
        where: { url },
        update: {
          keyword,
          currentStatus: currentStatus || null,
          myComment: myComment || null,
          updatedAt: new Date(),
        },
        create: {
          keyword,
          url,
          currentStatus: currentStatus || null,
          myComment: myComment || null,
        },
      })

      recordCount++
    }

    // 업로드 이력 저장
    await prisma.uploadHistory.create({
      data: {
        fileName: file.name,
        filePath,
        recordCount,
      },
    })

    return NextResponse.json({
      success: true,
      recordCount,
      message: `Successfully uploaded ${recordCount} records`,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

