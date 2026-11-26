import { AppError } from '../errors/AppError.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(
        422,
        'VALIDATION_ERROR',
        'Please check the submitted values.',
        result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      ));
    }
    if (source === 'body') req.body = result.data;
    else {
      req.validated ??= {};
      req.validated[source] = result.data;
    }
    next();
  };
}
