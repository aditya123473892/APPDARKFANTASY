export type SyncState = 'pending_upload' | 'pending' | 'syncing' | 'synced' | 'failed' | 'rejected';
export interface VaultPhoto {
  id: string;
  s3Key: string | null;
  localPath: string | null;
  sha256: string;
  size: number;
  status: 'local' | 'approved' | 'rejected';
  hidden: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  syncState: SyncState;
  error: string | null;
}
export interface QueueJob {
  id: string;
  photoId: string;
  operation: 'upload' | 'patch' | 'delete';
  attempts: number;
  nextAttemptAt: number;
}
export type RemotePhoto = Omit<VaultPhoto, 'localPath' | 'syncState' | 'error'>;
