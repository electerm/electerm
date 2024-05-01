/*
bitmap_decompress_32(uint8 * output, int outputWidth, int outputHeight, int inputWidth, int inputHeight, uint8* input, int size) {
  uint8 * temp = (uint8*)malloc(inputWidth * inputHeight * 4);
  RD_BOOL rv = bitmap_decompress4(temp, inputWidth, inputHeight, input, size);
  // convert to rgba
  for (int y = 0; y < outputHeight; y++) {
    for (int x = 0; x < outputWidth; x++) {
      uint8 r = temp[(y * inputWidth + x) * 4];
      uint8 g = temp[(y * inputWidth + x) * 4 + 1];
      uint8 b = temp[(y * inputWidth + x) * 4 + 2];
      uint8 a = temp[(y * inputWidth + x) * 4 + 3];
      ((uint32*)output)[y * outputWidth + x] = 0xff << 24 | r << 16 | g << 8 | b;
    }
  }
  return rv;
}
*/

function bitmapDecompress32 (output, outputWidth, outputHeight, inputWidth, inputHeight, input, size) {
  const temp = new Uint8Array(inputWidth * inputHeight * 4)
  const rv = bitmapDecompress4(temp, inputWidth, inputHeight, input, size)
  // convert to rgba
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const r = temp[(y * inputWidth + x) * 4]
      const g = temp[(y * inputWidth + x) * 4 + 1]
      const b = temp[(y * inputWidth + x) * 4 + 2]
      // const a = temp[(y * inputWidth + x) * 4 + 3]
      output[y * outputWidth + x] = 0xff << 24 | r << 16 | g << 8 | b
    }
  }
  return rv
}
