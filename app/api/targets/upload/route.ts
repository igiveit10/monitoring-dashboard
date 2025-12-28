import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

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
      // 표준 형식: keyword,url,currentStatus,myComment
      // 또는 QA 형식: _id,title,통검url3,통검노출,PDF 노출,비고
      let keyword: string | undefined
      let url: string | undefined
      let currentStatus: string | null = null
      let myComment: string | null = null

      if (record.keyword && record.url) {
        // 표준 형식
        keyword = record.keyword
        url = record.url
        currentStatus = record.currentStatus || null
        myComment = record.myComment || null
      } else if (record.title && record.통검url3) {
        // QA 형식
        keyword = record.title
        url = record.통검url3
        // 통검노출: Y -> "노출", N -> "미노출"
        if (record.통검노출 === 'Y') {
          currentStatus = '노출'
        } else if (record.통검노출 === 'N') {
          currentStatus = '미노출'
        }
        // PDF 노출은 별도 필드로 저장 (비고와 분리)
        const csvPdfExposure = record['PDF 노출'] === 'Y'
        // 비고는 참고용 텍스트만 저장 (PDF 노출 정보 제외)
        myComment = record.비고 || null
      }

      if (!keyword || !url) {
        continue // 필수 필드가 없으면 스킵
      }

      // URL이 이미 존재하는 경우, 정답셋(currentStatus, myComment)은 CSV에서 제공된 값으로만 업데이트
      // keyword는 업데이트 가능 (제목 변경 가능)
      await prisma.target.upsert({
        where: { url },
        update: {
          keyword, // 키워드는 업데이트 가능
          // 정답셋 값은 CSV에서 제공된 경우에만 업데이트
          currentStatus: currentStatus !== null ? currentStatus : undefined,
          csvPdfExposure: csvPdfExposure !== undefined ? csvPdfExposure : undefined,
          // 비고는 CSV에서 제공된 경우에만 업데이트 (기존 비고는 유지)
          myComment: myComment !== null ? myComment : undefined,
          updatedAt: new Date(),
        },
        create: {
          keyword,
          url,
          currentStatus,
          csvPdfExposure,
          myComment,
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

