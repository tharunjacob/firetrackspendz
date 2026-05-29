import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';

// ============================================================
// Admin Audit Service — logs every admin mutation
// ============================================================

export const logAdminAction = async (
  adminId: string,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
): Promise<void> => {
  try {
    await getSupabase().from(TABLES.ADMIN_AUDIT_LOG).insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  } catch {
    // Audit logging failures are non-fatal
    console.warn('Admin audit log failed:', action, targetType, targetId);
  }
};
