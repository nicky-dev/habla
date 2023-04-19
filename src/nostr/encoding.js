import { Buffer } from "buffer";
import { bech32 } from "bech32";
import * as secp from "@noble/secp256k1";
import { nip19 } from "nostr-tools";
import { findTag } from "./tags";

const BECH32_MAX_BYTES = 2000;

export function encodeTLV(hex, prefix, relays, author, kind) {
  const enc = new TextEncoder();

  let buf;
  if (prefix === "naddr" || prefix === "nrelay") {
    buf = enc.encode(hex);
  } else {
    buf = secp.utils.hexToBytes(hex);
  }
  const tl0 = [0, buf.length, ...buf];

  const enc2 = new TextEncoder();
  const tl1 =
    relays
      ?.map((a) => {
        const data = enc2.encode(a);
        return [1, data.length, ...data];
      })
      .flat() ?? [];

  let tl2 = [];
  if (author) {
    const authorBuff = secp.utils.hexToBytes(author);
    tl2 = [2, authorBuff.length, ...authorBuff];
  }

  let tl3 = [];
  if (kind) {
    const kindBuff = new Buffer(4);
    kindBuff.writeUInt32BE(kind);
    tl3 = [3, kindBuff.length, ...kindBuff];
  }

  return bech32.encode(
    prefix,
    bech32.toWords([...tl0, ...tl1, ...tl2, ...tl3]),
    BECH32_MAX_BYTES
  );
}

export function decodeTLV(str) {
  const decoded = bech32.decode(str, BECH32_MAX_BYTES);
  const data = bech32.fromWords(decoded.words);

  const entries = [];
  let x = 0;
  while (x < data.length) {
    const t = data[x];
    const l = data[x + 1];
    const v = data.slice(x + 2, x + 2 + l);
    entries.push({
      type: t,
      length: l,
      value: secp.utils.bytesToHex(new Uint8Array(v)),
    });
    x += 2 + l;
  }
  return entries;
}

export function encodeNaddr(ev, relays = []) {
  const d = ev.tags.find((t) => t[0] === "d")?.at(1);
  return encodeTLV(d, "naddr", relays, ev.pubkey, ev.kind);
}

function hexToString(value: string) {
  return Buffer.from(value, "hex").toString();
}

export function decodeNaddr(naddr) {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type === "naddr") {
      const data = decoded.data;
      return {
        d: data.identifier,
        k: data.kind,
        kind: data.kind,
        pubkey: data.pubkey,
        relays: data.relays,
      };
    }
  } catch (error) {}
}

export function encodeNrelay(relay) {
  return encodeTLV(relay, "nrelay");
}

export function decodeNrelay(nrelay) {
  try {
    const decoded = decodeTLV(nrelay);
    const rawRelay = decoded.find(({ type }) => type === 0);
    return hexToString(rawRelay.value);
  } catch (error) {}
}

export function decodeNprofile(nprofile) {
  const decoded = decodeTLV(nprofile);
  const dec = new TextDecoder();
  return {
    pubkey: decoded.find((r) => r.type === 0)?.value,
    relays: decoded
      .filter((r) => r.type === 1)
      .map((r) => dec.decode(Buffer.from(r.value, "hex"))),
  };
}

export function encodeNprofile(p, relays = []) {
  return encodeTLV(p, "nprofile", relays);
}

export function decodeNevent(nevent) {
  const decoded = decodeTLV(nevent);
  const dec = new TextDecoder();
  return {
    id: decoded.find((r) => r.type === 0)?.value,
    relays: decoded
      .filter((r) => r.type === 1)
      .map((r) => dec.decode(Buffer.from(r.value, "hex"))),
  };
}

export function encodeNevent(id, relays = []) {
  return encodeTLV(id, "nevent", relays);
}

export function eventAddress(ev) {
  const isReplaceable = ev.kind >= 10000 && ev.kind <= 19999;
  const isParamReplaceable = ev.kind >= 30000 && ev.kind <= 39999;
  if (isReplaceable || isParamReplaceable) {
    const d = findTag(ev.tags, "d");
    return `${ev.kind}:${ev.pubkey}:${d}`;
  }
}

export function hexToBech32(hex, prefix) {
  const buf = secp.utils.hexToBytes(hex);
  return bech32.encode(prefix, bech32.toWords(buf));
}

export function bech32ToHex(s) {
  const { words } = bech32.decode(s, BECH32_MAX_BYTES);
  const bytes = Buffer.from(bech32.fromWords(words));
  return bytes.toString("hex");
}

export function bech32ToText(str: string) {
  const decoded = bech32.decode(str, BECH32_MAX_BYTES);
  const buf = bech32.fromWords(decoded.words);
  return new TextDecoder().decode(Uint8Array.from(buf));
}
