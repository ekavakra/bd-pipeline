/**
 * Database Client Configuration
 *
 * Re-exports the singleton PrismaClient from @bd-pipeline/db.
 * This file exists so all internal imports use a consistent path:
 *   import { prisma } from '@/config/db'
 */

import { prisma } from '@bd-pipeline/db';

export { prisma };
export default prisma;
