export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message)
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, code, message)
  }
  static notFound(message = 'Not Found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message)
  }
  static badRequest(message = 'Bad Request', code = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, code, message, details)
  }
  static conflict(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
    return new ApiError(409, code, message, details)
  }
  static unprocessable(message = 'Validation failed', code = 'VALIDATION_ERROR', details?: unknown) {
    return new ApiError(422, code, message, details)
  }
}
