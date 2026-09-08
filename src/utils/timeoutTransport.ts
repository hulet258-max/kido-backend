import http from 'http';
import https from 'https';

// Bound the entire startup request, including DNS, connection and response body.
// A separate client uses this transport so normal video uploads have no 5s cap.
export function timeoutTransport(useSSL: boolean, timeoutMs = 5000) {
  const transport = useSSL ? https : http;
  return {
    request: ((options: http.RequestOptions, callback?: (response: http.IncomingMessage) => void) =>
      transport.request({ ...options, signal: AbortSignal.timeout(timeoutMs) }, callback)) as typeof http.request,
  };
}
