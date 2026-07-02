export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? defaultCode(statusCode);
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message = 'Bad Request', details?: unknown) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Not Found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  static conflict(message = 'Conflict', details?: unknown) {
    return new ApiError(409, message, 'CONFLICT', details);
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'ERROR';
  }
}
