/** Resolve a mídia real por trás do proxy antes de verificar sua disponibilidade. */
export function resolveValidationTargetUrl(targetUrl: string): string | null {
  let candidate = targetUrl;
  if (targetUrl.startsWith('/api/proxy?')) {
    candidate = new URL(targetUrl, 'https://zapitv.invalid').searchParams.get('url') || '';
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
