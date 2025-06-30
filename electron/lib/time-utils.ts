export function timeout(time?: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, time ?? 5);
  });
}

export function getTimestamp() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
