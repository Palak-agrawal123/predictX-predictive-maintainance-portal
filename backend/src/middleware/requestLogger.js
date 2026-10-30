export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logStr = `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    if (res.statusCode >= 500) {
      console.error(logStr);
    } else if (res.statusCode >= 400) {
      console.warn(logStr);
    } else {
      console.log(logStr);
    }
  });

  next();
}
