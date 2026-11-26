import { z } from 'zod';
import { uuidSchema } from '@/lib/validation/common';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_FILE_CATEGORIES = ['STUDENT_PHOTO', 'TEACHER_PHOTO', 'DOCUMENT'];
export const ALLOWED_OWNER_ENTITY_TYPES = ['STUDENT', 'TEACHER', 'PARENT', 'INVOICE', 'PAYMENT', 'GENERAL'];
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const MIME_TO_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
});

export const fileIdSchema = uuidSchema;

export const uploadFileFieldsSchema = z
  .object({
    category: z.enum(ALLOWED_FILE_CATEGORIES),
    ownerEntityType: z.enum(ALLOWED_OWNER_ENTITY_TYPES).nullable().optional(),
    ownerEntityId: uuidSchema.nullable().optional(),
  })
  .refine(
    (val) =>
      (val.ownerEntityType == null && val.ownerEntityId == null) ||
      (val.ownerEntityType != null && val.ownerEntityId != null),
    {
      message: 'ownerEntityType and ownerEntityId must both be provided or both omitted.',
    }
  );

/**
 * Inspect binary magic-byte headers to verify actual file type (never trust client Content-Type alone).
 *
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null}
 */
export function detectMimeFromMagicBytes(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 4) {
    return null;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  return null;
}
