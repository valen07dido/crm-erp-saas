export async function uploadImage(file: File, businessId: string): Promise<string> {
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
