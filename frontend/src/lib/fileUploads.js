import { env } from '../config/env.js';

export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
export const ACCEPTED_UPLOAD_FILES = '.pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.zip';

const MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip',
});

export function getUploadMimeType(file) {
  return MIME_BY_EXTENSION[file.name.toLowerCase().split('.').pop()];
}

export function validateUploadFile(file) {
  if (!file) return 'Choose a file before uploading.';
  if (!getUploadMimeType(file)) return 'Choose a PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, or ZIP file.';
  if (file.size < 1 || file.size > MAX_UPLOAD_SIZE) return 'Files must be between 1 byte and 20 MB.';
  return '';
}

export function uploadToSignedUrl(signedUrl, file, mimeType, accessToken, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('apikey', env.VITE_SUPABASE_ANON_KEY);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('content-type', mimeType);
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('The file upload failed. Check your connection and retry.'));
    };
    xhr.onerror = () => reject(new Error('The file upload failed. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('The file upload was cancelled.'));
    xhr.send(file);
  });
}
