/**
 * Dataset Manifest Engine (Phase 63).
 *
 * Catalogs dataset examples into a portable, cryptographically verifiable
 * DatasetManifest. Computes individual item checksums and root snapshot hashes.
 */
import type {
  DatasetLifecycleStatus,
  DatasetManifestPayload,
  ManifestItemEntry,
  VersionedDatasetExample,
} from "./types";

/**
 * Pure TypeScript SHA-256 hash helper for manifest checksumming.
 */
function sha256Hex(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (len % 64 < 56) ? (56 - (len % 64)) : (120 - (len % 64));
  const totalLen = len + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < totalLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[j] + w[j]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
}

export class DatasetManifest {
  /**
   * Generates a complete DatasetManifestPayload from a collection of versioned examples.
   */
  static generateManifest(
    datasetId: string,
    datasetVersion: string,
    status: DatasetLifecycleStatus,
    examples: VersionedDatasetExample[],
    options?: { isImmutable?: boolean; lockedIso?: string; metadata?: Record<string, unknown> }
  ): DatasetManifestPayload {
    const itemEntries: ManifestItemEntry[] = [];
    const splitsCount = { train: 0, validation: 0, test: 0, unassigned: 0 };

    for (const ex of examples) {
      const split = ex.split || "unassigned";
      splitsCount[split]++;

      // Deterministic JSON hash of core example
      const jsonStr = JSON.stringify({
        id: ex.itemId,
        pieces: ex.pieces,
        interfaces: ex.interfaces,
        connections: ex.connections,
        assembly: ex.assembly,
        split: ex.split,
      });

      const checksum = sha256Hex(jsonStr);

      itemEntries.push({
        exampleId: ex.itemId,
        sourceFile: ex.provenance.source_file,
        split: ex.split,
        checksumSha256: checksum,
        pieceCount: ex.pieces?.length || 0,
        interfaceCount: ex.interfaces?.length || 0,
        connectionCount: ex.connections?.length || 0,
        versionMetadata: ex.versionMetadata,
      });
    }

    // Sort item entries deterministically by exampleId
    itemEntries.sort((a, b) => a.exampleId.localeCompare(b.exampleId));

    // Compute root snapshot hash over sorted checksums
    const aggregatedChecksums = itemEntries.map((e) => `${e.exampleId}:${e.checksumSha256}`).join("\n");
    const rootSnapshotHash = sha256Hex(aggregatedChecksums || "empty_dataset");

    return {
      manifestVersion: "1.0.0",
      datasetId,
      datasetVersion,
      status,
      createdIso: new Date().toISOString(),
      lockedIso: options?.lockedIso,
      rootSnapshotHash,
      isImmutable: options?.isImmutable ?? false,
      totalExamples: examples.length,
      splitsCount,
      itemEntries,
      metadata: options?.metadata,
    };
  }

  /**
   * Serializes manifest to formatted JSON string.
   */
  static serialize(manifest: DatasetManifestPayload): string {
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Deserializes manifest from JSON string and verifies schema.
   */
  static deserialize(jsonString: string): DatasetManifestPayload {
    const parsed = JSON.parse(jsonString) as DatasetManifestPayload;
    if (!parsed.manifestVersion || !parsed.datasetVersion || !parsed.rootSnapshotHash) {
      throw new Error("INVALID_MANIFEST: Manifest missing mandatory versioning fields.");
    }
    return parsed;
  }
}
