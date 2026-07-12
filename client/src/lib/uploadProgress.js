const units = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** unitIndex);
  const digits = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatRemainingTime(value) {
  const seconds = Math.max(0, Math.ceil(Number(value) || 0));
  if (seconds < 1) return 'Less than 1 second';
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

export function calculateUploadProgress(loadedValue, totalValue, elapsedMsValue) {
  const loaded = Math.max(0, Number(loadedValue) || 0);
  const total = Math.max(loaded, Number(totalValue) || 0);
  const elapsedSeconds = Math.max(0, Number(elapsedMsValue) || 0) / 1000;
  const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const bytesPerSecond = elapsedSeconds >= 0.25 && loaded > 0 ? loaded / elapsedSeconds : 0;
  const remainingSeconds = bytesPerSecond > 0 && total > loaded
    ? (total - loaded) / bytesPerSecond
    : percent >= 100 ? 0 : null;

  return {
    loaded,
    total,
    percent,
    bytesPerSecond,
    remainingSeconds,
    status: percent >= 100 ? 'processing' : 'uploading',
  };
}
