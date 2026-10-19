export function unwrapServiceResponse(response, noResponseMessage) {
  if (!response) {
    throw new Error(noResponseMessage);
  }
  if (!response.success) {
    throw new Error(response.error);
  }

  return response.result;
}
