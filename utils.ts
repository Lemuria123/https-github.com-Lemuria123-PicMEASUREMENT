import { GROUP_COLORS } from './constants';

/**
 * Generates a unique ID using crypto when available, falling back to random string.
 */
export const generateId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
};

/**
 * Returns a random color from the predefined palette for new groups.
 */
export const getRandomColor = (): string => GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

/**
 * Prepares image for Gemini API by resizing and converting to base64.
 */
export const optimizeImageForAPI = async (src: string, maxRes: number, quality: number): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
       const img = new Image(); 
       img.crossOrigin = "Anonymous"; 
       img.onload = () => {
          let width = img.width; 
          let height = img.height; 
          const MAX_SIZE = maxRes;
          if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) { 
                  height = Math.round((height * MAX_SIZE) / width); 
                  width = MAX_SIZE; 
              } else { 
                  width = Math.round((width * MAX_SIZE) / height); 
                  height = MAX_SIZE; 
              }
          }
          const canvas = document.createElement('canvas'); 
          canvas.width = width; 
          canvas.height = height;
          const ctx = canvas.getContext('2d'); 
          if (!ctx) { 
              reject(new Error("Failed to get 2D context")); 
              return; 
          }
          // Use a dark background for transparency cases
          ctx.fillStyle = "#111111"; 
          ctx.fillRect(0, 0, width, height); 
          ctx.drawImage(img, 0, 0, width, height);
          const dataURL = canvas.toDataURL('image/jpeg', quality);
          resolve({ data: dataURL.split(',')[1], mimeType: 'image/jpeg' });
       };
       img.onerror = () => reject(new Error("Failed to load image for optimization"));
       img.src = src;
    });
};