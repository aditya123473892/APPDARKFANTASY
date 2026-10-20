export type UploadProgress = {
  stage: 'prepare' | 'request' | 'transfer' | 'confirm' | 'complete';
  percent?: number;
  attempt: number;
};
export type UploadProgressListener = (progress: UploadProgress) => void;
export function uploadProgressLabel(progress: UploadProgress): string {
  const label = {
    prepare: 'Preparing photo',
    request: 'Starting upload',
    transfer: 'Uploading photo',
    confirm: 'Checking photo',
    complete: 'Photo ready',
  }[progress.stage];
  return `${progress.attempt > 1 ? `Retry ${progress.attempt - 1}: ` : ''}${label}${
    progress.stage === 'transfer' && progress.percent !== undefined ? ` ${progress.percent}%` : ''
  }`;
}
