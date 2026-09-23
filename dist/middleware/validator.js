import { ZodError } from 'zod';
/**
 * Validates request body against a Zod schema.
 * Replaces 15+ lines of manual if-else validation per route with a single preHandler.
 */
export function validateBody(schema) {
    return async (request, reply) => {
        try {
            request.body = schema.parse(request.body);
        }
        catch (err) {
            if (err instanceof ZodError) {
                return reply.code(400).send({
                    success: false,
                    error: 'Validation Error',
                    details: err.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                });
            }
            return reply.code(400).send({
                success: false,
                error: 'Invalid Request Body',
            });
        }
    };
}
/**
 * Validates request query parameters against a Zod schema.
 */
export function validateQuery(schema) {
    return async (request, reply) => {
        try {
            request.query = schema.parse(request.query);
        }
        catch (err) {
            if (err instanceof ZodError) {
                return reply.code(400).send({
                    success: false,
                    error: 'Query Validation Error',
                    details: err.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                });
            }
            return reply.code(400).send({
                success: false,
                error: 'Invalid Query Parameters',
            });
        }
    };
}
/**
 * Validates route parameters (e.g. :id, :slug) against a Zod schema.
 */
export function validateParams(schema) {
    return async (request, reply) => {
        try {
            request.params = schema.parse(request.params);
        }
        catch (err) {
            if (err instanceof ZodError) {
                return reply.code(400).send({
                    success: false,
                    error: 'Parameter Validation Error',
                    details: err.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                });
            }
            return reply.code(400).send({
                success: false,
                error: 'Invalid Route Parameters',
            });
        }
    };
}
