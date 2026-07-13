/* ============================================================
   CODELENS — Global Express Error Handler
   Catches errors forwarded via next(err) from any route.
   ============================================================ */

'use strict';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log server errors (not 4xx)
  if (status >= 500) {
    console.error(`[CodeLens] ${req.method} ${req.path} → ${status}:`, err);
  }

  res.status(status).json({
    error:  message,
    status,
    path:   req.path,
    method: req.method,
  });
}

module.exports = errorHandler;
