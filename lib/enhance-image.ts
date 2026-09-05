export async function enhanceImage(imageUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not supported'));
        return;
      }

      // Keep original dimensions, or upscale slightly if very small
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Apply convolution matrix (Sharpening kernel)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      const kernel = [
        0, -1,  0,
       -1,  5, -1,
        0, -1,  0
      ];
      
      const side = Math.round(Math.sqrt(kernel.length));
      const halfSide = Math.floor(side / 2);
      
      const src = imageData.data;
      const sw = canvas.width;
      const sh = canvas.height;
      
      const output = ctx.createImageData(w, h);
      const dst = output.data;

      // Loop through pixels
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dstOff = (y * w + x) * 4;
          let r = 0, g = 0, b = 0;
          
          for (let cy = 0; cy < side; cy++) {
            for (let cx = 0; cx < side; cx++) {
              const scy = y + cy - halfSide;
              const scx = x + cx - halfSide;
              
              if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                const srcOff = (scy * sw + scx) * 4;
                const wt = kernel[cy * side + cx];
                
                r += src[srcOff] * wt;
                g += src[srcOff + 1] * wt;
                b += src[srcOff + 2] * wt;
              }
            }
          }
          
          // Apply brightness/contrast boost manually
          // Contrast formula: f(x) = (x - 128) * contrast + 128
          const contrast = 1.1; // 10% more contrast
          const brightness = 5; // Slight brightness boost
          
          dst[dstOff] = Math.min(255, Math.max(0, (r - 128) * contrast + 128 + brightness));
          dst[dstOff + 1] = Math.min(255, Math.max(0, (g - 128) * contrast + 128 + brightness));
          dst[dstOff + 2] = Math.min(255, Math.max(0, (b - 128) * contrast + 128 + brightness));
          dst[dstOff + 3] = src[dstOff + 3]; // keep alpha
        }
      }

      ctx.putImageData(output, 0, 0);

      // Export to blob
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from canvas'));
        },
        'image/png',
        1.0
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for enhancement'));
    img.src = imageUrl;
  });
}
