// A picture the user attaches to a question, as the Assistant sends it: a JPEG no larger than vision models read
// at full detail

const MAX_SIDE = 1568;
const MAX_BYTES = 20_000_000;

async function read(file: Blob): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("The image is over 20 MB");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("The pasted file cannot be read as an image");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export const AssistantImages = { read };
