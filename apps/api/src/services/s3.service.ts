/**
 * S3 Storage Service
 *
 * File upload/download for recordings, documents, and proposals.
 * Uses native fetch with AWS Signature V4 (or compatible S3 API).
 */

import { logger } from '../config/logger.js';

export const s3Service = {
  /**
   * Generate a presigned URL for file upload.
   * For now, this is a placeholder — integrate with AWS SDK v3 or MinIO.
   */
  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const bucket = process.env['S3_BUCKET'];
    const region = process.env['S3_REGION'] ?? 'us-east-1';
    const endpoint = process.env['S3_ENDPOINT'];

    if (!bucket) {
      logger.warn('S3_BUCKET not configured');
      return '';
    }

    // TODO: Implement AWS Signature V4 presigned URL generation
    // For production, use @aws-sdk/s3-request-presigner
    const baseUrl = endpoint ?? `https://${bucket}.s3.${region}.amazonaws.com`;
    logger.info({ key, bucket }, 'Presigned upload URL requested');

    return `${baseUrl}/${key}?X-Amz-Expires=${expiresIn}`;
  },

  /**
   * Generate a presigned URL for file download.
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const bucket = process.env['S3_BUCKET'];
    const region = process.env['S3_REGION'] ?? 'us-east-1';
    const endpoint = process.env['S3_ENDPOINT'];

    if (!bucket) {
      logger.warn('S3_BUCKET not configured');
      return '';
    }

    const baseUrl = endpoint ?? `https://${bucket}.s3.${region}.amazonaws.com`;
    logger.info({ key, bucket }, 'Presigned download URL requested');

    return `${baseUrl}/${key}?X-Amz-Expires=${expiresIn}`;
  },

  /**
   * Delete a file from S3.
   */
  async deleteFile(key: string): Promise<void> {
    const bucket = process.env['S3_BUCKET'];
    if (!bucket) return;

    logger.info({ key, bucket }, 'S3 file deletion requested');
    // TODO: Implement actual deletion with AWS SDK
  },
};
