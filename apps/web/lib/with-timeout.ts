/** Wrap a promise with a timeout. Rejects if not resolved within ms. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback?: T
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timeout")), ms)
  );
  try {
    return await Promise.race([promise, timeout]);
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}
