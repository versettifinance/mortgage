import { prisma } from "../db";

export async function logAudit(userId: string, action: string, entityType?: string, entityId?: string, details?: string) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, details },
  });
}
