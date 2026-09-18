import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

interface AuditParams {
  module: string;
  action: string;
  recordId: string;
  recordType: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
}

export async function logAudit(params: AuditParams) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, 'auditLog'), {
      ...params,
      performedBy: user.uid,
      performedByEmail: user.email ?? 'unknown',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
