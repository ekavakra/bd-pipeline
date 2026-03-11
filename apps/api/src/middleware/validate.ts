/**
 * Zod Request Validation Middleware
 *
 * Validates request body, query, or params against a Zod schema.
 * Returns 422 with structured error details on validation failure.
 *
 * Usage:
 *   router.post('/leads', validate({ body: createLeadSchema }), handler);
 *   router.get('/leads', validate({ query: leadListQuerySchema }), handler);
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/api-error.js';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Creates middleware that validates the specified request parts
 * against Zod schemas. On success, replaces req.body/query/params
 * with the parsed (and potentially transformed) values.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Record<string, unknown> = {};

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors['body'] = formatZodError(result.error);
      } else {
        req.body = result.data;
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors['query'] = formatZodError(result.error);
      } else {
        req.query = result.data as Record<string, string>;
      }
    }

    // Validate route parameters
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors['params'] = formatZodError(result.error);
      } else {
        req.params = result.data as Record<string, string>;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Request validation failed', errors);
    }

    next();
  };
}

/**
 * Formats Zod validation errors into a readable structure.
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
