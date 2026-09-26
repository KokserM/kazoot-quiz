const { ZodError } = require('zod');

// Errors whose message is safe and useful to show to the person using Kazoot.
class UserFacingError extends Error {
  constructor(message, { code = 'bad_request', status = 400 } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.userFacing = true;
  }
}

// Converts any error into { status, code, message } without leaking internals
// (database errors, provider messages, stack traces).
function toClientError(error) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'invalid_input',
      message: [...new Set(error.issues.map((issue) => issue.message))].join(' '),
    };
  }
  if (error?.userFacing) {
    return {
      status: error.status || 400,
      code: error.code || 'bad_request',
      message: error.userMessage || error.message,
    };
  }
  return {
    status: 500,
    code: 'internal_error',
    message: 'Something went wrong on our side. Please try again.',
  };
}

module.exports = { UserFacingError, toClientError };
