(function exposeModelEngine(global) {
  "use strict";

  const DEFAULT_SIMULATION_COUNT = 1000;

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < String(value).length; index += 1) {
      hash ^= String(value).charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRandom(seed) {
    let state = hashString(seed) || 1;
    return function random() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function interpolate(start, end, ratio) {
    return start + (end - start) * ratio;
  }

  // P10, P50 ve P90 model çıktılarından sürekli bir ampirik dağılım üretir.
  // Uç bölgeler, komşu yüzdelik aralıklarının dörtte biri kadar uzatılır.
  function sampleFromQuantiles(quantiles, random) {
    const [p10, p50, p90] = quantiles.map(value => Math.max(0, Number(value) || 0));
    const lower = Math.max(0, p10 - (p50 - p10) * 0.25);
    const upper = Math.max(p90, p90 + (p90 - p50) * 0.25);
    const probability = random();
    if (probability < 0.10) return interpolate(lower, p10, probability / 0.10);
    if (probability < 0.50) return interpolate(p10, p50, (probability - 0.10) / 0.40);
    if (probability < 0.90) return interpolate(p50, p90, (probability - 0.50) / 0.40);
    return interpolate(p90, upper, (probability - 0.90) / 0.10);
  }

  function sampleRuns(quantiles, seed, count = DEFAULT_SIMULATION_COUNT) {
    const random = createRandom(seed);
    return Array.from({ length: count }, () => sampleFromQuantiles(quantiles, random));
  }

  function quantile(values, probability) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const position = (sorted.length - 1) * probability;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) return sorted[lowerIndex];
    return interpolate(sorted[lowerIndex], sorted[upperIndex], position - lowerIndex);
  }

  function summarize(values) {
    return [quantile(values, 0.10), quantile(values, 0.50), quantile(values, 0.90)];
  }

  function probabilityAtLeast(values, target) {
    if (!values.length) return 0;
    const tolerance = Math.max(0.001, Math.abs(target) * 1e-9);
    return values.filter(value => value >= target - tolerance).length / values.length;
  }

  global.ModelEngine = Object.freeze({
    DEFAULT_SIMULATION_COUNT,
    hashString,
    createRandom,
    sampleFromQuantiles,
    sampleRuns,
    quantile,
    summarize,
    probabilityAtLeast
  });
})(typeof window !== "undefined" ? window : globalThis);
