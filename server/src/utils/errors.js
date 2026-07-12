export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const assert = (condition, status, message, code, details) => {
  if (!condition) throw new AppError(status, message, code, details);
};

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFound = (req, _res, next) => {
  next(new AppError(404, `No route matches ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
};

export const errorHandler = (error, _req, res, _next) => {
  let status = error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'An unexpected error occurred';
  let details = error.details;

  if (error.name === 'ValidationError') {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'The submitted data is invalid';
    details = Object.values(error.errors || {}).map((item) => item.message);
  } else if (error.code === 11000) {
    status = 409;
    code = 'ALREADY_EXISTS';
    message = `${Object.keys(error.keyPattern || {})[0] || 'Value'} is already in use`;
  } else if (error.name === 'MulterError') {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    code = error.code;
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'The authentication token is invalid or expired';
  }

  if (status >= 500) console.error(error);

  res.status(status).json({
    error: {
      code,
      message: status >= 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected server error occurred'
        : message,
      ...(details ? { details } : {})
    }
  });
};

