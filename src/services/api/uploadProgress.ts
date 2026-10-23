export type UploadProgress = {
  stage: 'prepare' | 'request' | 'transfer' | 'confirm' | 'complete';
  percent?: number;
  attempt: number;
  kind?: 'photo' | 'video';
};
export type UploadProgressListener = (progress: UploadProgress) => void;
export function uploadProgressLabel(progress: UploadProgress): string {
  const noun = progress.kind === 'video' ? 'video' : 'photo';
  const label = {
    prepare: `Preparing ${noun}`,
    request: 'Starting upload',
    transfer: `Uploading ${noun}`,
    confirm: `Checking ${noun}`,
    complete: `${noun === 'video' ? 'Video' : 'Photo'} ready`,
  }[progress.stage];
  return `${progress.attempt > 1 ? `Retry ${progress.attempt - 1}: ` : ''}${label}${
    progress.stage === 'transfer' && progress.percent !== undefined ? ` ${progress.percent}%` : ''
  }`;
}
