export const MAX_FUND_DOC_SIZE_KB = 2048; // 2 MB
export const MAX_FUND_DOC_BYTES = MAX_FUND_DOC_SIZE_KB * 1024; // 2,097,152 bytes
export const PREFERRED_COMPRESSED_BYTES = Math.round(1.5 * 1024 * 1024); // ~1.5 MB target for best clarity under 2 MB

export interface ProcessedFundDocumentSuccess {
  ok: true;
  fileName: string;
  sanitizedName: string;
  virtualPath: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  originalSizeKb: number;
  compressedSizeKb: number;
  wasCompressed: boolean;
  sha256: string;
}

export interface ProcessedFundDocumentFailure {
  ok: false;
  error: string;
  originalSizeKb?: number;
}

export type ProcessedFundDocumentResult =
  | ProcessedFundDocumentSuccess
  | ProcessedFundDocumentFailure;

export function bytesToRoundedKb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.max(1, Math.round(bytes / 1024));
}

export function formatFileSizeKb(kb: number): string {
  if (!Number.isFinite(kb) || kb <= 0) return '0 KB';
  const roundedKb = Math.round(kb);
  const formattedKb = roundedKb.toLocaleString('id-ID');
  if (roundedKb >= 1024) {
    const mbText = (roundedKb / 1024).toFixed(2).replace('.', ',');
    return `${mbText} MB (${formattedKb} KB)`;
  }
  return `${formattedKb} KB`;
}

export function validateFundDocumentSizeKb(sizeKb: number): {
  valid: boolean;
  error?: string;
} {
  if (!Number.isFinite(sizeKb) || sizeKb <= 0) {
    return {
      valid: false,
      error: 'Lampiran dokumen pendukung (maksimal 2 MB) wajib diunggah.',
    };
  }
  if (sizeKb > MAX_FUND_DOC_SIZE_KB) {
    return {
      valid: false,
      error: `Ukuran dokumen (${formatFileSizeKb(sizeKb)}) melebihi batas maksimal 2 MB (2.048 KB).`,
    };
  }
  return { valid: true };
}

export function sanitizeUploadFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return 'dokumen-pengajuan.pdf';
  const dotIdx = trimmed.lastIndexOf('.');
  const rawBase = dotIdx > 0 ? trimmed.slice(0, dotIdx) : trimmed;
  const rawExt = dotIdx > 0 ? trimmed.slice(dotIdx).toLowerCase() : '';
  const cleanBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const cleanExt = rawExt.replace(/[^a-z0-9.]/g, '');
  return `${cleanBase || 'dokumen'}${cleanExt}`;
}

export function replaceFileExtension(fileName: string, newExt: string): string {
  const cleanExt = newExt.startsWith('.') ? newExt : `.${newExt}`;
  const dotIdx = fileName.lastIndexOf('.');
  const base = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  return `${base}${cleanExt}`;
}

export function isSupportedFundDocumentType(
  mimeType: string,
  fileName: string
): 'image' | 'pdf' | null {
  const mime = mimeType.toLowerCase().trim();
  const lowerName = fileName.toLowerCase().trim();
  if (
    mime === 'application/pdf' ||
    (!mime && lowerName.endsWith('.pdf')) ||
    lowerName.endsWith('.pdf')
  ) {
    return 'pdf';
  }
  if (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp')
  ) {
    return 'image';
  }
  return null;
}

/**
 * Picks the highest-quality candidate that stays within <= 2 MB (MAX_FUND_DOC_BYTES),
 * preferring the largest size up to ~1.9 MB so text/receipts stay sharp without exceeding 2 MB.
 */
export function pickBestCompressedCandidate<T extends { sizeBytes: number }>(
  candidates: T[],
  maxBytes: number = MAX_FUND_DOC_BYTES
): T | null {
  const underLimit = candidates.filter((c) => c.sizeBytes > 0 && c.sizeBytes <= maxBytes);
  if (underLimit.length === 0) return null;
  const comfortableLimit = Math.round(maxBytes * 0.95);
  const comfortable = underLimit.filter((c) => c.sizeBytes <= comfortableLimit);
  const pool = comfortable.length > 0 ? comfortable : underLimit;
  return pool.reduce((best, current) =>
    current.sizeBytes > best.sizeBytes ? current : best
  );
}

export async function computeArrayBufferSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic non-crypto fallback only when WebCrypto digest is unavailable
  const view = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const step = Math.max(1, Math.floor(view.length / 4096));
  for (let i = 0; i < view.length; i += step) {
    h1 = Math.imul(h1 ^ view[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (view[i] + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

interface ImageSource {
  width: number;
  height: number;
  drawTo: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      drawTo: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => bitmap.close(),
    };
  }
  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    el.src = objectUrl;
  });
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    drawTo: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

interface BlobCandidate {
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
}

async function compressOversizedImageUnder2Mb(
  file: File
): Promise<{ ok: true; blob: Blob; mimeType: string } | { ok: false; error: string }> {
  const source = await loadImageSource(file);
  const candidates: BlobCandidate[] = [];

  try {
    const scales = [1.0, 0.85, 0.7, 0.55, 0.4, 0.28];
    for (const scale of scales) {
      const targetW = Math.max(1, Math.round(source.width * scale));
      const targetH = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { ok: false, error: 'Gagal menyiapkan kanvas kompresi gambar di browser.' };
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      source.drawTo(ctx, targetW, targetH);

      // Binary search JPEG quality from 0.35 to 0.94 to stay <= 2 MB with crisp clarity
      let low = 0.35;
      let high = 0.94;
      let foundUnder2Mb = false;

      for (let iter = 0; iter < 5; iter += 1) {
        const mid = Number(((low + high) / 2).toFixed(3));
        const blob = await canvasToBlob(canvas, 'image/jpeg', mid);
        if (!blob) break;
        candidates.push({ blob, mimeType: 'image/jpeg', sizeBytes: blob.size });
        if (blob.size <= MAX_FUND_DOC_BYTES) {
          foundUnder2Mb = true;
          low = mid; // try higher quality while staying <= 2 MB
        } else {
          high = mid;
        }
      }

      if (foundUnder2Mb) break;
    }

    const best = pickBestCompressedCandidate(candidates);
    if (best) {
      return {
        ok: true,
        blob: best.blob,
        mimeType: best.mimeType,
      };
    }

    return {
      ok: false,
      error: 'Berkas gambar gagal dikompres hingga ≤ 2 MB. Coba unggah gambar dengan resolusi lebih kecil.',
    };
  } finally {
    source.cleanup();
  }
}

export async function processFundDocumentUpload(
  file: File
): Promise<ProcessedFundDocumentResult> {
  const originalSizeKb = bytesToRoundedKb(file.size);
  const kind = isSupportedFundDocumentType(file.type, file.name);

  if (!kind) {
    return {
      ok: false,
      originalSizeKb,
      error: 'Format berkas tidak didukung. Unggah dokumen PDF atau gambar (JPG, PNG, WEBP).',
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      originalSizeKb: 0,
      error: 'Berkas kosong atau tidak dapat dibaca.',
    };
  }

  // Any supported file already <= 2 MB is accepted directly without requiring minimum size
  if (file.size <= MAX_FUND_DOC_BYTES) {
    const buf = await file.arrayBuffer();
    const sha256 = await computeArrayBufferSha256(buf);
    const sanitizedName = sanitizeUploadFileName(file.name);
    return {
      ok: true,
      fileName: file.name,
      sanitizedName,
      virtualPath: `/uploads/docs/${sanitizedName}`,
      mimeType: file.type || (kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      originalSizeBytes: file.size,
      compressedSizeBytes: file.size,
      originalSizeKb,
      compressedSizeKb: originalSizeKb,
      wasCompressed: false,
      sha256,
    };
  }

  // File exceeds 2 MB
  if (kind === 'pdf') {
    return {
      ok: false,
      originalSizeKb,
      error: `Ukuran PDF (${formatFileSizeKb(originalSizeKb)}) melebihi 2 MB (2.048 KB). Kompres PDF hingga ≤ 2 MB atau unggah foto/scan JPG/PNG untuk kompresi otomatis.`,
    };
  }

  // Image > 2 MB: compress automatically to <= 2 MB
  const compressed = await compressOversizedImageUnder2Mb(file);
  if (!compressed.ok) {
    return {
      ok: false,
      originalSizeKb,
      error: compressed.error,
    };
  }

  const finalSizeKb = bytesToRoundedKb(compressed.blob.size);
  const check = validateFundDocumentSizeKb(finalSizeKb);
  if (!check.valid) {
    return {
      ok: false,
      originalSizeKb,
      error: check.error ?? 'Ukuran dokumen setelah kompresi melebihi batas 2 MB.',
    };
  }

  const buf = await compressed.blob.arrayBuffer();
  const sha256 = await computeArrayBufferSha256(buf);
  const sanitizedBase = sanitizeUploadFileName(file.name);
  const finalName = replaceFileExtension(sanitizedBase, '.jpg');

  return {
    ok: true,
    fileName: file.name,
    sanitizedName: finalName,
    virtualPath: `/uploads/docs/${finalName}`,
    mimeType: compressed.mimeType,
    originalSizeBytes: file.size,
    compressedSizeBytes: compressed.blob.size,
    originalSizeKb,
    compressedSizeKb: finalSizeKb,
    wasCompressed: true,
    sha256,
  };
}
