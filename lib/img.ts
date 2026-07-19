// Utilidades de archivos para el modo demo: convierte archivos a data-URLs
// (redimensionando imágenes) para poder persistirlos en localStorage.
// Al conectar Supabase Storage, esto se reemplaza por uploads reales.

export async function imageToDataUrl(file: File, maxDim: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

const MAX_RAW_BYTES = 2 * 1024 * 1024; // 2 MB para PDFs/documentos en demo

export function rawToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_RAW_BYTES) {
    return Promise.reject(
      new Error('En modo demo los documentos deben pesar menos de 2 MB. Con Supabase conectado no habrá límite práctico.'),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export async function fileToDataUrl(file: File, maxImageDim: number): Promise<string> {
  if (file.type.startsWith('image/')) return imageToDataUrl(file, maxImageDim);
  return rawToDataUrl(file);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
