export async function compressImage(file, maxSizeKB = 50, maxPx = 300) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let quality = 0.8;
      const tryNext = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          if (blob.size <= maxSizeKB * 1024 || quality <= 0.1) resolve(blob);
          else { quality = Math.round((quality - 0.1) * 10) / 10; tryNext(); }
        }, "image/jpeg", quality);
      };
      tryNext();
    };
    img.onerror = reject;
    img.src = url;
  });
}
