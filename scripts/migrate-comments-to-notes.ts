/**
 * 마이그레이션 스크립트: RunResult.myComment -> Target.note
 * 
 * 목적: 기존에 RunResult.myComment에 저장된 값을 Target.note로 마이그레이션
 * 
 * 실행 방법:
 *   로컬: npx tsx scripts/migrate-comments-to-notes.ts
 *   Render: render shell 접속 후 npx tsx scripts/migrate-comments-to-notes.ts
 * 
 * 주의: 이 스크립트는 1회만 실행해야 함. 실행 후 이 파일을 삭제할 것.
 */

import { PrismaClient } from '@prisma/client'

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

async function main() {
  const prisma = getPrisma()
  
  try {
    console.log('[MIGRATE] Starting migration: RunResult.myComment -> Target.note')
    
    // RunResult에서 myComment가 있는 모든 레코드 조회
    // 주의: Prisma schema에서 myComment 필드가 제거되었으므로, raw SQL 사용
    const resultsWithComments = await prisma.$queryRaw<Array<{
      id: string
      targetId: string
      myComment: string | null
    }>>`
      SELECT id, "targetId", "myComment"
      FROM "RunResult"
      WHERE "myComment" IS NOT NULL
        AND "myComment" != ''
    `
    
    console.log(`[MIGRATE] Found ${resultsWithComments.length} RunResults with myComment`)
    
    if (resultsWithComments.length === 0) {
      console.log('[MIGRATE] No RunResults with myComment found. Migration skipped.')
      return
    }
    
    // targetId별로 그룹화하고, 가장 최근 myComment 값 사용
    const targetNoteMap = new Map<string, string>()
    
    for (const result of resultsWithComments) {
      const existingNote = targetNoteMap.get(result.targetId)
      const currentComment = result.myComment?.trim() || ''
      
      // 기존 note가 없거나, 현재 comment가 더 길면 업데이트
      if (!existingNote || currentComment.length > existingNote.length) {
        targetNoteMap.set(result.targetId, currentComment)
      }
    }
    
    console.log(`[MIGRATE] Unique targets to update: ${targetNoteMap.size}`)
    
    let updatedCount = 0
    let skippedCount = 0
    
    // 각 target의 note 업데이트
    for (const [targetId, note] of targetNoteMap.entries()) {
      try {
        // 기존 Target.note 확인
        const target = await prisma.target.findUnique({
          where: { id: targetId },
          select: { note: true },
        })
        
        // 기존 note가 있으면 스킵 (덮어쓰지 않음)
        if (target?.note && target.note.trim().length > 0) {
          skippedCount++
          console.log(`[MIGRATE] Skipping ${targetId}: already has note="${target.note.substring(0, 30)}..."`)
          continue
        }
        
        // note 업데이트
        await prisma.target.update({
          where: { id: targetId },
          data: { note },
        })
        
        updatedCount++
        console.log(`[MIGRATE] Updated ${targetId}: note="${note.substring(0, 50)}${note.length > 50 ? '...' : ''}"`)
      } catch (error: any) {
        console.error(`[MIGRATE] Error updating target ${targetId}:`, error.message)
        skippedCount++
      }
    }
    
    console.log(`\n[MIGRATE] === Summary ===`)
    console.log(`[MIGRATE] Updated: ${updatedCount}`)
    console.log(`[MIGRATE] Skipped (already has note): ${skippedCount}`)
    console.log(`[MIGRATE] Total RunResults processed: ${resultsWithComments.length}`)
    console.log(`[MIGRATE] Migration completed successfully`)
    
    console.log(`\n[MIGRATE] === Next Steps ===`)
    console.log(`[MIGRATE] 1. Prisma migration 실행: npx prisma migrate dev --name remove_runresult_mycomment`)
    console.log(`[MIGRATE] 2. 이 스크립트 파일 삭제: rm scripts/migrate-comments-to-notes.ts`)
    
  } catch (error) {
    console.error('[MIGRATE] Migration error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error('[MIGRATE] Fatal error:', e)
    process.exit(1)
  })

