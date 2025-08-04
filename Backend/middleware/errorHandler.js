const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Default error
  let error = {
    message: err.message || "Internal Server Error",
    status: err.status || 500,
  };

  // Handle specific error types
  if (err.name === "ValidationError") {
    error.status = 400;
    error.message = "Validation Error";
    error.details = err.details;
  } else if (err.name === "UnauthorizedError") {
    error.status = 401;
    error.message = "Unauthorized";
  } else if (err.name === "ForbiddenError") {
    error.status = 403;
    error.message = "Forbidden";
  } else if (err.name === "NotFoundError") {
    error.status = 404;
    error.message = "Resource not found";
  } else if (err.code === "LIMIT_FILE_SIZE") {
    error.status = 413;
    error.message = "File too large";
  } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
    error.status = 400;
    error.message = "Unexpected file field";
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === "production" && error.status === 500) {
    error.message = "Internal Server Error";
  }

  res.status(error.status).json({
    error: error.message,
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = {
  errorHandler,
};
