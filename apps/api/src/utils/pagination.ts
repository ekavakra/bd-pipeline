/**
 * Pagination Helper
 *
 * Takes page/limit query params and returns Prisma-compatible
 * skip/take values plus a meta object for the API response.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Calculate Prisma skip/take from page/limit.
 *
 * @param page - Current page (1-indexed)
 * @param limit - Items per page
 * @returns Object with skip and take for Prisma queries
 */
export function paginate(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build pagination meta for API response.
 *
 * @param total - Total number of items matching the query
 * @param page - Current page number
 * @param limit - Items per page
 * @returns PaginationMeta object
 */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
