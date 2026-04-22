import { prisma } from "@/lib/db";

interface AuditParams {
  orgId: string;
  userId: string;
  action: string; // create, update, delete, export, login, status_change
  entity: string; // product, sale, invoice, shipment, user, category, settings, credit_note
  entityId?: string;
  details?: string;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details: params.details || null,
      },
    });
  } catch (error) {
    // Don't let audit failures break the main operation
    console.error("Audit log error:", error);
  }
}
