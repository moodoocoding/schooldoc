/**
 * 수합을 만든 직후에는 원본 PDF가 아직 스토리지에 올라가는 중일 수 있다.
 * 그 상태는 실패가 아니라 준비 중이므로, 서버는 425로 답하고 화면은
 * 오류 대신 준비 안내를 띄운 뒤 스스로 다시 시도한다.
 */
export const PREPARING_STATUS = 425;

export const PREPARING_MESSAGE = '가정통신문을 준비하고 있습니다. 잠시 후 자동으로 열립니다.';

export class DocumentPreparingError extends Error {
  status = PREPARING_STATUS;

  constructor() {
    super(PREPARING_MESSAGE);
    this.name = 'DocumentPreparingError';
  }
}

export const statusOf = (error: unknown) => (
  typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: number }).status)
    : undefined
);

export const isPreparing = (error: unknown) => statusOf(error) === PREPARING_STATUS;

/** 준비 중이면 길게, 서버 오류면 짧게 기다린다. 4xx는 다시 시도해도 소용없다. */
export const retryDelay = (attempt: number, preparing: boolean) => (
  preparing ? 2_000 : Math.min(700 * (attempt + 1), 3_000)
);

export const shouldRetry = (error: unknown) => {
  const status = statusOf(error);
  if (isPreparing(error)) return true;
  return !status || status >= 500;
};

export const retryLoad = async <T>(operation: () => Promise<T>, options: {
  attempts?: number;
  onPreparing?: () => void;
  wait?: (milliseconds: number) => Promise<void>;
} = {}): Promise<T> => {
  const attempts = options.attempts ?? 3;
  const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  }));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const preparing = isPreparing(error);
      if (preparing) options.onPreparing?.();
      if (!shouldRetry(error)) throw error;
      if (attempt < attempts - 1) await wait(retryDelay(attempt, preparing));
    }
  }
  throw lastError;
};
