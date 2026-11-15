function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // readAsDataURL yields "data:<mime>;base64,<data>" — only the part
      // after the comma is what the server's Buffer.from(..., 'base64') wants.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Error leyendo el archivo'));
    reader.readAsDataURL(file);
  });
}

async function uploadImageLocal(file: File, businessId: string): Promise<string> {
  const dataBase64 = await fileToBase64(file);
  const res = await fetch('/api/local-images/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
    body: JSON.stringify({ contentType: file.type, dataBase64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'No se pudo subir la imagen');
  }
  const { url } = await res.json();
  return url as string;
}

async function uploadImageCloudinary(file: File, businessId: string): Promise<string> {
  const sigRes = await fetch('/api/cloudinary/signature', {
    method: 'POST',
    headers: { 'x-business-id': businessId },
  });
  if (!sigRes.ok) {
    const err = await sigRes.json().catch(() => ({}));
    throw new Error(err.error || 'No se pudo iniciar la subida de imagen');
  }
  const { signature, timestamp, apiKey, cloudName, folder } = await sigRes.json();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(data?.error?.message || 'Error subiendo la imagen a Cloudinary');
  }
  return data.secure_url as string;
}

export async function uploadImage(file: File, businessId: string): Promise<string> {
  // WALTI Desktop has no Cloudinary account/subscription to depend on — see
  // src/pages/api/local-images/* for where this goes instead.
  if (process.env.NEXT_PUBLIC_WALTI_DESKTOP_BUILD === '1') {
    return uploadImageLocal(file, businessId);
  }
  return uploadImageCloudinary(file, businessId);
}
