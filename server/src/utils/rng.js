export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng, max) {
  return Math.floor(rng() * max);
}

export function randomBetween(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, array) {
  return array[randomInt(rng, array.length)];
}

export function shuffled(rng, array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sample(rng, array, size) {
  if (size >= array.length) return [...array];
  return shuffled(rng, array).slice(0, size);
}

export function randomNormal(rng, mean = 0, stdDev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdDev;
}

export default mulberry32;
