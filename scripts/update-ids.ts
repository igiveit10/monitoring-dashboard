import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('ID 업데이트 시작...')

  // CSV 파일 읽기
  const csvPath = join(process.cwd(), 'scripts', 'ID추가.csv')
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

  console.log(`총 ${records.length}개의 레코드를 발견했습니다.`)

  let successCount = 0
  let notFoundCount = 0
  let errorCount = 0

  // 각 레코드 처리
  for (const record of records) {
    const csvId = record.ID || record.id || record._id
    const title = record.title
    const url = record.url

    if (!csvId || !title) {
      console.log(`스킵: ID 또는 title이 없습니다 - ${JSON.stringify(record)}`)
      continue
    }

    try {
      // title로 기존 레코드 찾기
      const existing = await prisma.target.findFirst({
        where: {
          keyword: title,
        },
      })

      if (!existing) {
        console.log(`찾을 수 없음: ${title}`)
        notFoundCount++
        continue
      }

      // ID가 이미 같으면 스킵
      if (existing.id === csvId) {
        console.log(`이미 동일한 ID: ${csvId} - ${title}`)
        continue
      }

      // SQLite에서 직접 ID 업데이트 (Prisma는 ID 변경을 지원하지 않음)
      // Foreign key constraint를 일시적으로 비활성화하고 업데이트
      
      // 새 ID가 이미 존재하는지 확인
      const existingWithNewId = await prisma.target.findUnique({
        where: { id: csvId },
      })

      if (existingWithNewId) {
        console.log(`⚠️  새 ID가 이미 존재함: ${csvId} - ${title}`)
        errorCount++
        continue
      }

      // Foreign key 체크 비활성화
      await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`)

      try {
        // 임시 ID 생성
        const tempId = `temp_${existing.id.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
        
        // 1. RunResult의 targetId를 임시 값으로 변경
        await prisma.$executeRawUnsafe(`
          UPDATE RunResult 
          SET targetId = '${tempId.replace(/'/g, "''")}' 
          WHERE targetId = '${existing.id.replace(/'/g, "''")}'
        `)

        // 2. Target의 ID를 임시 값으로 변경
        await prisma.$executeRawUnsafe(`
          UPDATE Target 
          SET id = '${tempId.replace(/'/g, "''")}' 
          WHERE id = '${existing.id.replace(/'/g, "''")}'
        `)

        // 3. Target의 ID를 새 ID로 변경
        await prisma.$executeRawUnsafe(`
          UPDATE Target 
          SET id = '${csvId.replace(/'/g, "''")}' 
          WHERE id = '${tempId.replace(/'/g, "''")}'
        `)

        // 4. RunResult의 targetId를 새 ID로 변경
        await prisma.$executeRawUnsafe(`
          UPDATE RunResult 
          SET targetId = '${csvId.replace(/'/g, "''")}' 
          WHERE targetId = '${tempId.replace(/'/g, "''")}'
        `)
      } finally {
        // Foreign key 체크 재활성화
        await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`)
      }

      // URL도 업데이트 (제공된 경우)
      if (url && url !== existing.url) {
        await prisma.target.update({
          where: { id: csvId },
          data: { url },
        })
      }

      console.log(`✅ 업데이트 완료: ${existing.id} -> ${csvId} - ${title}`)
      successCount++
    } catch (error: any) {
      console.error(`❌ 에러: ${title}`, error.message)
      errorCount++
    }
  }

  console.log(`\n업데이트 완료:`)
  console.log(`  - 성공: ${successCount}개`)
  console.log(`  - 찾을 수 없음: ${notFoundCount}개`)
  console.log(`  - 에러: ${errorCount}개`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

