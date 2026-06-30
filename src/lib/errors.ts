export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    readonly title: string,
    readonly detail: string,
  ) {
    super(detail)
    this.name = this.constructor.name
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Authentication is required. Please log in.') {
    super(401, 'urn:marketplace:error:unauthorized', 'Unauthorized', detail)
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'You do not have permission to perform this action.') {
    super(403, 'urn:marketplace:error:forbidden', 'Forbidden', detail)
  }
}

export class ConflictError extends AppError {
  constructor(detail = 'A resource with the given identifier already exists.') {
    super(409, 'urn:marketplace:error:conflict', 'Conflict', detail)
  }
}

export class NotFoundError extends AppError {
  constructor(detail = 'The requested resource does not exist.') {
    super(404, 'urn:marketplace:error:not-found', 'Not Found', detail)
  }
}

export class InvalidTokenError extends AppError {
  constructor(detail = 'The token is invalid, expired, or has already been used.') {
    super(400, 'urn:marketplace:error:invalid-token', 'Invalid Token', detail)
  }
}

export class ValidationError extends AppError {
  constructor(detail = 'The request body failed validation.') {
    super(422, 'urn:marketplace:error:validation', 'Unprocessable Entity', detail)
  }
}
