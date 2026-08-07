/**
 * Redimensiona y comprime una foto en el navegador antes de subirla — las fotos de
 * celular suelen pesar 3-8 MB, lo cual es lento/caro en datos móviles desde sucursales
 * con señal débil. Se limita el lado más largo a maxDimension y se reexporta como
 * JPEG con la calidad indicada.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.75): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  // Si por lo que sea la "compresión" salió más pesada (fotos ya chicas), se queda con la original.
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // sigue al fallback de <img> si el formato no es soportado por createImageBitmap
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
