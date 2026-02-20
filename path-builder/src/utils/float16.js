/**
 * Float16 decoding utilities — shared by segmentSearchService and docsSearchService.
 *
 * The embedding pipeline quantizes vectors to float16 (half-precision)
 * for storage efficiency. These helpers decode them back to Float32.
 */

/**
 * Convert a float16 (half-precision) to float32.
 * @param {number} half - 16-bit float as uint16
 * @returns {number}
 */
export function float16ToFloat32(half) {
  const sign = (half >> 15) & 0x1;
  const exponent = (half >> 10) & 0x1f;
  const mantissa = half & 0x3ff;

  if (exponent === 0) {
    // Denormalized
    return (sign ? -1 : 1) * Math.pow(2, -14) * (mantissa / 1024);
  } else if (exponent === 31) {
    // Inf / NaN
    return mantissa ? NaN : sign ? -Infinity : Infinity;
  }
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + mantissa / 1024);
}

/**
 * Decode a base64-encoded float16 vector to a Float32Array.
 * @param {string} b64 - Base64-encoded float16 vector
 * @param {number} dim - Expected dimension (default 768)
 * @returns {Float32Array}
 */
export function decodeFloat16Vector(b64, dim = 768) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const result = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    // Read float16 (2 bytes each, little-endian)
    const half = view.getUint16(i * 2, true);
    result[i] = float16ToFloat32(half);
  }
  return result;
}
