export function createVideoThumbnail(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const timeout = setTimeout(() => finish(new Error('Thumbnail timed out')), 10000);
    const finish = (error?: Error, result?: string) => {
      clearTimeout(timeout);
      video.onerror = null;
      video.onloadeddata = null;
      video.removeAttribute('src');
      video.load();
      if (error) reject(error);
      else resolve(result!);
    };
    video.muted = true;
    video.preload = 'metadata';
    video.onerror = () => finish(new Error('Thumbnail unavailable'));
    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = Math.round((640 * video.videoHeight) / video.videoWidth);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            blob
              ? finish(undefined, URL.createObjectURL(blob))
              : finish(new Error('Thumbnail unavailable')),
          'image/jpeg',
          0.7,
        );
      } catch {
        finish(new Error('Thumbnail unavailable'));
      }
    };
    video.src = uri;
  });
}
