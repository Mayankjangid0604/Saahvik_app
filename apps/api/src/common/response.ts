export function wrapSuccess(data: unknown, apiVersion: string) {
  return {
    success: true,
    data,
    apiVersion,
  };
}

export function wrapError(
  code: string,
  message: string,
  apiVersion: string = 'v1',
) {
  return {
    success: false,
    error: { code, message },
    apiVersion,
  };
}
