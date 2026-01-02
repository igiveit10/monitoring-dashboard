import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records found' }, { status: 400 })
    }

    // Process records
    const results = await prisma.$transaction(
      records.map((record: any) => {
        const id = record.id || record.ID || ''
        const title = record.title || record.Title || ''
        const url = record.url || record.URL || ''
        const expectedSearch = record.expectedSearch === 'true' || record.expectedSearch === 'Y' || record.expectedSearch === '1'
        const expectedPdf = record.expectedPdf === 'true' || record.expectedPdf === 'Y' || record.expectedPdf === '1'
        const note = record.note || record.Note || null

        if (!id || !title || !url) {
          throw new Error(`Invalid record: id=${id}, title=${title}, url=${url}`)
        }

        return prisma.target.upsert({
          where: { id },
          update: {
            title,
            url,
            expectedSearch,
            expectedPdf,
            note: note && note.trim() !== '' ? note.trim() : null,
          },
          create: {
            id,
            title,
            url,
            expectedSearch,
            expectedPdf,
            note: note && note.trim() !== '' ? note.trim() : null,
          },
        })
      })
    )

    return NextResponse.json({
      success: true,
      count: results.length,
    })
  } catch (error) {
    console.error('[Upload API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

