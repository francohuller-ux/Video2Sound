/**
 * Converts a File object to a base64 encoded string, stripping the data URL prefix.
 * @param file The File object to convert.
 * @returns A promise that resolves with the base64 string.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:video/mp4;base64," part
      const base64 = result.split(',')[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error("Failed to extract base64 from file data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}
