import { validateBill, type BillAttachment } from './reimbursementPolicy';

export async function convertBill(file: File, owner: string, claim: string, proof = false): Promise<BillAttachment> {
  validateBill(file, proof);
  let url: string;
  let contentType = file.type;
  if (file.type === 'application/pdf') {
    if (file.size > 300 * 1024) throw new Error('PDF must be under 300 KB. You can attach a photo of the bill instead.');
    url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Unable to read bill')); reader.readAsDataURL(file);
    });
  } else {
    const source = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Unable to read image')); img.src = source;
      });
      const canvas = document.createElement('canvas');
      for (const edge of [1600, 1400, 1200, 1000]) {
        const scale = Math.min(1, edge / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image conversion unavailable');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        url = canvas.toDataURL('image/jpeg', 0.8);
        if (url.length <= 200000) break;
      }
      if (url!.length > 200000) throw new Error('This image is too large after compression. Crop the bill and try again.');
      contentType = 'image/jpeg';
    } finally { URL.revokeObjectURL(source); }
  }
  return { name: file.name, url: url!, contentType, size: Math.floor((url!.split(',')[1].length * 3) / 4), path: `reimbursement-files/${owner}/${claim}/${proof ? 'proof' : 'bills'}/${crypto.randomUUID()}` };
}

// Reserve space for payment metadata and one compressed payment-proof image.
export function assertClaimSize(data: unknown, limit = 700000) {
  if (new TextEncoder().encode(JSON.stringify(data)).length > limit) throw new Error('The attached bills are too large for one request. Use smaller/cropped images or submit separate requests.');
}
