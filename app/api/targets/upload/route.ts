import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { prisma } from '../../../../lib/prisma'
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
      // 지원 형식:
      // 1. 표준 형식: keyword,url,currentStatus,myComment (id 또는 _id 선택)
      // 2. QA 형식: _id,title,통검url3,통검노출,PDF 노출,비고
      // 3. 간단 형식: id,title (title로 매핑하여 정답셋 업데이트)
      let keyword: string | undefined
      let url: string | undefined
      let currentStatus: string | null = null
      let myComment: string | null = null
      let csvId: string | undefined = undefined
      let csvPdfExposure: boolean | undefined = undefined

      // CSV에서 id 추출 (여러 필드명 지원)
      csvId = record.id || record._id || undefined
      
      // keyword/title 추출
      keyword = record.keyword || record.title || undefined

      if (record.keyword && record.url) {
        // 표준 형식: keyword,url,currentStatus,myComment
        url = record.url
        currentStatus = record.currentStatus || null
        myComment = record.myComment || null
      } else if (record.title && record.통검url3) {
        // QA 형식: _id,title,통검url3,통검노출,PDF 노출,비고
        url = record.통검url3
        // 통검노출: Y -> "노출", N -> "미노출"
        if (record.통검노출 === 'Y') {
          currentStatus = '노출'
        } else if (record.통검노출 === 'N') {
          currentStatus = '미노출'
        }
        // PDF 노출은 별도 필드로 저장 (비고와 분리)
        csvPdfExposure = record['PDF 노출'] === 'Y'
        // 비고는 참고용 텍스트만 저장 (PDF 노출 정보 제외)
        myComment = record.비고 || null
      } else if (csvId && keyword && !url) {
        // 간단 형식: id,title (title로 매핑)
        // URL이 없으면 title로 기존 레코드를 찾아서 업데이트만 수행
        // 이 경우 URL은 업데이트하지 않음
      } else if (keyword && record.url) {
        // keyword/title과 url이 있는 경우
        url = record.url
        currentStatus = record.currentStatus || null
        myComment = record.myComment || null
      }

      // keyword/title이 없으면 스킵
      if (!keyword) {
        continue
      }

      // 매핑 전략:
      // 1. ID가 있고 URL이 있으면: ID로 찾거나 URL로 찾아서 업데이트
      // 2. ID가 있고 URL이 없으면: ID로 직접 찾아서 업데이트
      // 3. ID가 없고 URL이 있으면: URL로 찾아서 업데이트
      // 4. ID가 없고 URL이 없고 title만 있으면: title(keyword)로 찾아서 업데이트
      // 5. 아무것도 없으면 스킵

      let existing: any = null

      if (csvId) {
        // ID가 있는 경우: ID로 먼저 찾기
        try {
          existing = await prisma.target.findUnique({
            where: { id: csvId },
          })
        } catch (e) {
          // ID 형식이 잘못된 경우 무시
        }
      }

      if (!existing && url) {
        // ID로 못 찾았고 URL이 있으면 URL로 찾기
        existing = await prisma.target.findUnique({
          where: { url },
        })
      }

      if (!existing && keyword && !url) {
        // ID도 URL도 없고 keyword만 있으면 keyword로 찾기 (title 매핑)
        existing = await prisma.target.findFirst({
          where: { keyword },
        })
      }

      if (existing) {
        // 기존 레코드가 있으면 업데이트
        const updateData: any = {}
        
        // keyword는 항상 업데이트 (제목 변경 가능)
        if (keyword) updateData.keyword = keyword
        
        // 정답셋 값은 CSV에서 제공된 경우에만 업데이트
        if (currentStatus !== null) updateData.currentStatus = currentStatus
        if (csvPdfExposure !== undefined) updateData.csvPdfExposure = csvPdfExposure
        if (myComment !== null) updateData.myComment = myComment
        
        // URL은 제공된 경우에만 업데이트 (간단 형식에서는 URL 없음)
        if (url && url !== existing.url) {
          // URL이 변경되는 경우, 새 URL이 이미 존재하는지 확인
          const urlExists = await prisma.target.findUnique({
            where: { url },
          })
          if (!urlExists) {
            updateData.url = url
          }
        }

        updateData.updatedAt = new Date()

        await prisma.target.update({
          where: { id: existing.id },
          data: updateData,
        })
      } else {
        // 새 레코드인 경우 생성
        if (!url) {
          // URL이 없으면 생성할 수 없음
          continue
        }

        try {
          await prisma.target.create({
            data: {
              ...(csvId ? { id: csvId } : {}),
              keyword,
              url,
              currentStatus,
              csvPdfExposure,
              myComment,
            },
          })
        } catch (error: any) {
          // ID 충돌 시 (이미 다른 레코드에 사용된 경우) 자동 생성 ID 사용
          if (error.code === 'P2002' && csvId) {
            await prisma.target.create({
              data: {
                keyword,
                url,
                currentStatus,
                csvPdfExposure,
                myComment,
              },
            })
          } else {
            throw error
          }
        }
      }

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

