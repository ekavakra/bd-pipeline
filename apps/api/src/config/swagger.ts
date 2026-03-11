/**
 * Swagger / OpenAPI Configuration
 *
 * Generates OpenAPI spec from Zod schemas using zod-to-openapi.
 * Serves interactive documentation at /api/docs.
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

/** Global OpenAPI registry — modules register their routes here */
export const registry = new OpenAPIRegistry();

/**
 * Generate OpenAPI spec and mount Swagger UI on the Express app.
 * Called once during app bootstrap.
 */
export function setupSwagger(app: Express): void {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const spec = generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'BD Pipeline API',
      version: '1.0.0',
      description:
        'Client Onboarding & Business Development Service — API documentation',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    security: [{ bearerAuth: [] }],
  });

  // Register the bearer auth scheme
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'BD Pipeline — API Docs',
  }));
}
