const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 200 * 1024;
const ANALYSIS_MAX_EDGE = 1600;
const OUTPUT_MAX_WIDTH = 1000;
const OUTPUT_MAX_HEIGHT = 400;

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedSignaturePhoto {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

interface InkExtraction {
  pixels: Uint8ClampedArray;
  bounds: PixelBounds | null;
  inkPixels: number;
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

const luminance = (red: number, green: number, blue: number) => (
  red * 0.299 + green * 0.587 + blue * 0.114
);

const median = (values: number[]) => {
  if (values.length === 0) return 255;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const estimateBackground = (data: Uint8ClampedArray) => {
  const samples: Array<{ red: number; green: number; blue: number; light: number }> = [];
  const pixelCount = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.floor(pixelCount / 20_000));

  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const index = pixel * 4;
    if (data[index + 3] < 128) continue;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    samples.push({ red, green, blue, light: luminance(red, green, blue) });
  }

  const brightest = samples
    .toSorted((a, b) => b.light - a.light)
    .slice(0, Math.max(1, Math.ceil(samples.length * 0.2)));

  return {
    red: median(brightest.map((sample) => sample.red)),
    green: median(brightest.map((sample) => sample.green)),
    blue: median(brightest.map((sample) => sample.blue)),
  };
};

export const extractSignatureInk = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  paddingRatio = 0.04,
): InkExtraction => {
  if (width <= 0 || height <= 0 || data.length !== width * height * 4) {
    throw new RangeError('이미지 픽셀 크기가 올바르지 않습니다.');
  }

  const background = estimateBackground(data);
  const backgroundLight = luminance(background.red, background.green, background.blue);
  const pixels = new Uint8ClampedArray(data.length);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let inkPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const sourceAlpha = data[index + 3] / 255;
      const light = luminance(red, green, blue);
      const colorDistance = Math.sqrt(
        (red - background.red) ** 2
        + (green - background.green) ** 2
        + (blue - background.blue) ** 2,
      );
      const darkness = Math.max(0, backgroundLight - light);
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      const score = Math.max(darkness, colorDistance * 0.72, saturation * 0.45);
      const inkAlpha = clamp((score - 18) / 62, 0, 1) * sourceAlpha;

      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
      pixels[index + 3] = Math.round(inkAlpha * 255);

      if (inkAlpha < 0.18) continue;
      inkPixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  const minimumInkPixels = Math.max(12, Math.floor(width * height * 0.00005));
  if (right < left || bottom < top || inkPixels < minimumInkPixels) {
    return { pixels, bounds: null, inkPixels };
  }

  const detectedWidth = right - left + 1;
  const detectedHeight = bottom - top + 1;
  const padding = Math.max(6, Math.round(Math.max(detectedWidth, detectedHeight) * paddingRatio));
  const paddedLeft = Math.max(0, left - padding);
  const paddedTop = Math.max(0, top - padding);
  const paddedRight = Math.min(width - 1, right + padding);
  const paddedBottom = Math.min(height - 1, bottom + padding);

  return {
    pixels,
    bounds: {
      x: paddedLeft,
      y: paddedTop,
      width: paddedRight - paddedLeft + 1,
      height: paddedBottom - paddedTop + 1,
    },
    inkPixels,
  };
};

export const fitSignatureSize = (
  width: number,
  height: number,
  maxWidth = OUTPUT_MAX_WIDTH,
  maxHeight = OUTPUT_MAX_HEIGHT,
) => {
  if (width <= 0 || height <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    throw new RangeError('이미지 크기는 0보다 커야 합니다.');
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const decodeImage = async (file: File) => {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement for browsers with partial bitmap support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  try {
    await image.decode();
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => (
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('사진을 서명 이미지로 변환하지 못했습니다.'));
    }, type, quality);
  })
);

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') resolve(reader.result);
    else reject(new Error('보정된 서명 이미지를 읽지 못했습니다.'));
  };
  reader.onerror = () => reject(reader.error ?? new Error('보정된 서명 이미지를 읽지 못했습니다.'));
  reader.readAsDataURL(blob);
});

const encodeSignature = async (initialCanvas: HTMLCanvasElement) => {
  let canvas = initialCanvas;
  let blob = await canvasToBlob(canvas, 'image/png');
  if (blob.size <= MAX_OUTPUT_BYTES) return { canvas, blob };

  blob = await canvasToBlob(canvas, 'image/webp', 0.9);
  for (let attempt = 0; blob.size > MAX_OUTPUT_BYTES && attempt < 8; attempt += 1) {
    const resized = makeCanvas(
      Math.max(1, Math.round(canvas.width * 0.82)),
      Math.max(1, Math.round(canvas.height * 0.82)),
    );
    resized.getContext('2d')?.drawImage(canvas, 0, 0, resized.width, resized.height);
    canvas = resized;
    blob = await canvasToBlob(canvas, 'image/webp', Math.max(0.68, 0.86 - attempt * 0.06));
  }
  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('서명 사진 용량을 충분히 줄이지 못했습니다. 서명 부분을 더 가까이 촬영해 주세요.');
  }
  return { canvas, blob };
};

export const normalizeSignaturePhoto = async (file: File): Promise<NormalizedSignaturePhoto> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 사용할 수 있습니다.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('사진은 15MB 이하 파일을 선택해 주세요.');
  }

  let decoded: Awaited<ReturnType<typeof decodeImage>> | null = null;
  try {
    decoded = await decodeImage(file);
    if (decoded.width <= 0 || decoded.height <= 0) {
      throw new Error('사진 크기를 확인할 수 없습니다.');
    }

    const analysisSize = fitSignatureSize(
      decoded.width,
      decoded.height,
      ANALYSIS_MAX_EDGE,
      ANALYSIS_MAX_EDGE,
    );
    const analysisCanvas = makeCanvas(analysisSize.width, analysisSize.height);
    const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
    if (!analysisContext) throw new Error('사진 처리 기능을 사용할 수 없습니다.');
    analysisContext.fillStyle = '#ffffff';
    analysisContext.fillRect(0, 0, analysisCanvas.width, analysisCanvas.height);
    analysisContext.drawImage(decoded.source, 0, 0, analysisCanvas.width, analysisCanvas.height);

    const imageData = analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
    const extraction = extractSignatureInk(
      imageData.data,
      analysisCanvas.width,
      analysisCanvas.height,
    );
    if (!extraction.bounds) {
      throw new Error('서명 획을 찾지 못했습니다. 밝은 종이 위의 서명이 선명하게 보이도록 다시 촬영해 주세요.');
    }

    const extractedCanvas = makeCanvas(extraction.bounds.width, extraction.bounds.height);
    const extractedContext = extractedCanvas.getContext('2d');
    if (!extractedContext) throw new Error('사진 처리 기능을 사용할 수 없습니다.');
    const imagePixels = new Uint8ClampedArray(extraction.pixels.length);
    imagePixels.set(extraction.pixels);
    const transparentImage = new ImageData(imagePixels, analysisCanvas.width, analysisCanvas.height);
    extractedContext.putImageData(transparentImage, -extraction.bounds.x, -extraction.bounds.y);

    const outputSize = fitSignatureSize(extractedCanvas.width, extractedCanvas.height);
    const outputCanvas = makeCanvas(outputSize.width, outputSize.height);
    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) throw new Error('사진 처리 기능을 사용할 수 없습니다.');
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = 'high';
    outputContext.drawImage(extractedCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

    const encoded = await encodeSignature(outputCanvas);
    return {
      dataUrl: await blobToDataUrl(encoded.blob),
      width: encoded.canvas.width,
      height: encoded.canvas.height,
      bytes: encoded.blob.size,
      mimeType: encoded.blob.type,
    };
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error('사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.');
  } finally {
    decoded?.close();
  }
};
