import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export interface SteganographyPayload {
  chainId: number;
  contractAddress: string;
  txHash: string;
  sentinelVersion: number;
}

function hexToBytes32(hex: string): number[] {
  const clean = hex.replace("0x", "").padStart(64, "0").slice(0, 64);
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes; // exactly 32 bytes
}

function addressToBytes20(address: string): number[] {
  const clean = address.replace("0x", "").padStart(40, "0").slice(0, 40);
  const bytes: number[] = [];
  for (let i = 0; i < 40; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes; // exactly 20 bytes
}

function uint32ToBytes(n: number): number[] {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ];
}

export function buildPayload(p: SteganographyPayload): Uint8Array {
  const chainBytes = uint32ToBytes(p.chainId);              // 4 bytes
  const contractBytes = addressToBytes20(p.contractAddress); // 20 bytes
  const txBytes = hexToBytes32(p.txHash);                    // 32 bytes
  const versionByte = [p.sentinelVersion & 0xff];            // 1 byte
  // total: 57 bytes
  return new Uint8Array([...chainBytes, ...contractBytes, ...txBytes, ...versionByte]);
}

export function decodePayload(data: Uint8Array): SteganographyPayload {
  const chainId = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
  const contractAddress =
    "0x" + Array.from(data.slice(4, 24)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const txHash =
    "0x" + Array.from(data.slice(24, 56)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const sentinelVersion = data[56];
  return { chainId, contractAddress, txHash, sentinelVersion };
}

export function generateProofPNG(payload: SteganographyPayload, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, "sentinel.proof.png");
  const payloadBytes = buildPayload(payload);
  const width = 16;
  const height = 16;
  const pixels = new Uint8Array(width * height * 4);

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0x1a;
    pixels[i + 1] = 0x1a;
    pixels[i + 2] = 0x2e;
    pixels[i + 3] = 0xff;
  }

  let bitIndex = 0;
  for (let byteIndex = 0; byteIndex < payloadBytes.length; byteIndex++) {
    for (let bit = 7; bit >= 0; bit--) {
      const payloadBit = (payloadBytes[byteIndex] >> bit) & 1;
      pixels[bitIndex] = (pixels[bitIndex] & 0xfe) | payloadBit;
      bitIndex++;
    }
  }

  const png = buildPNG(pixels, width, height);
  writeFileSync(outPath, png);
  return outPath;
}

function buildPNG(pixels: Uint8Array, width: number, height: number): Buffer {
  const crc32 = makeCRC32();

  function chunk(type: string, data: Buffer): Buffer {
    const typeBytes = Buffer.from(type, "ascii");
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.allocUnsafe(4);
    crcVal.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = pixels[i * 4];
    rgb[i * 3 + 1] = pixels[i * 4 + 1];
    rgb[i * 3 + 2] = pixels[i * 4 + 2];
  }

  const scanlines = Buffer.allocUnsafe(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width * 3; x++) {
      scanlines[y * (1 + width * 3) + 1 + x] = rgb[y * width * 3 + x];
    }
  }

  const idat = buildZlibUncompressed(scanlines);
  const iend = Buffer.alloc(0);

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", iend)]);
}

function buildZlibUncompressed(data: Buffer): Buffer {
  const cmf = 0x78;
  const flg = 0x01;
  const len = data.length;
  const nlen = (~len) & 0xffff;

  const block = Buffer.allocUnsafe(5 + data.length);
  block[0] = 0x01;
  block.writeUInt16LE(len, 1);
  block.writeUInt16LE(nlen, 3);
  data.copy(block, 5);

  let s1 = 1, s2 = 0;
  for (const b of data) {
    s1 = (s1 + b) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = Buffer.allocUnsafe(4);
  adler.writeUInt32BE(((s2 << 16) | s1) >>> 0, 0);

  return Buffer.concat([Buffer.from([cmf, flg]), block, adler]);
}

function makeCRC32() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
}
