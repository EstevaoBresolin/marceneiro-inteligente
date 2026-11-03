import * as THREE from 'three';
import type { Padrao } from '../domain/padroes';

/** Tamanho, em mm, que um ladrilho da textura cobre no móvel */
export const MM_POR_TEXTURA = 1100;

const cache = new Map<string, THREE.Texture>();

/** gerador pseudoaleatório com semente (mesmo desenho sempre) */
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** cor em sRGB 0–255 (sem conversão para linear: o canvas já é sRGB) */
const hex = (c: string) => {
  const v = parseInt(c.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/**
 * Madeira: faixas de veio ao longo de x (o "comprimento" da textura), com ondulação, nós leves e variação de tom.
 * Tudo desenhado no canvas, sem imagem externa.
 */
function desenharMadeira(ctx: CanvasRenderingContext2D, n: number, p: Padrao) {
  const r = rnd(p.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const base = hex(p.base);
  const veio = hex(p.veio ?? p.base);
  const img = ctx.createImageData(n, n);
  const esc = p.escala ?? 1;
  // ruído 1D por linha para a ondulação dos veios
  const fases = Array.from({ length: 6 }, () => r() * Math.PI * 2);
  const freq = [1, 2, 3, 5, 8, 13].map((f) => f * (0.6 + r() * 0.8));
  const amp = [9, 6, 3.5, 1.8, 0.9, 0.5].map((a) => a * esc);
  const tons = Array.from({ length: n }, () => r());
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let off = 0;
      for (let k = 0; k < 6; k++) off += amp[k] * Math.sin((x / n) * Math.PI * 2 * freq[k] + fases[k] + y * 0.004 * k);
      const yy = y + off;
      // anéis: seno com frequência irregular
      const t = (yy / n) * (11 / esc);
      const anel = Math.pow(Math.abs(Math.sin(t * Math.PI + Math.sin(t * 0.7) * 1.3)), 6 + 10 * tons[Math.floor(((yy % n) + n) % n)]);
      const fibra = 0.5 + 0.5 * Math.sin(yy * 2.1 + Math.sin(x * 0.05) * 2);
      const m = Math.min(1, anel * 0.55 + fibra * 0.07 + (tons[Math.floor(((yy % n) + n) % n)] - 0.5) * 0.06);
      const i = (y * n + x) * 4;
      img.data[i] = base[0] + (veio[0] - base[0]) * m;
      img.data[i + 1] = base[1] + (veio[1] - base[1]) * m;
      img.data[i + 2] = base[2] + (veio[2] - base[2]) * m;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function desenharTextura(ctx: CanvasRenderingContext2D, n: number, p: Padrao) {
  const r = rnd(42);
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, n, n);
  ctx.globalAlpha = 0.08;
  for (let k = 0; k < 2200; k++) {
    ctx.fillStyle = r() > 0.5 ? (p.veio ?? '#000') : '#ffffff';
    const s = 2 + r() * 14;
    ctx.beginPath();
    ctx.arc(r() * n, r() * n, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** textura do padrão (criada uma vez); null para liso */
export function texturaDoPadrao(p: Padrao | undefined): THREE.Texture | null {
  if (!p || p.tipo === 'liso' || typeof document === 'undefined') return null;
  const ja = cache.get(p.id);
  if (ja) return ja;
  const n = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  if (p.tipo === 'madeira') desenharMadeira(ctx, n, p);
  else desenharTextura(ctx, n, p);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(p.id, t);
  return t;
}

/**
 * Caixa com coordenadas de textura em mm: o veio (eixo x da textura) segue o eixo `veio` da peça
 * quando ele está no plano da face; nas bordas, segue o maior lado.
 */
export function geometriaComVeio(size: [number, number, number], veio: 0 | 1 | 2): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(...size);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const eixoNormal = n[0] > 0.5 ? 0 : n[1] > 0.5 ? 1 : 2;
    const noPlano = [0, 1, 2].filter((a) => a !== eixoNormal) as (0 | 1 | 2)[];
    const u = noPlano.includes(veio) ? veio : size[noPlano[0]] >= size[noPlano[1]] ? noPlano[0] : noPlano[1];
    const v = noPlano.find((a) => a !== u)!;
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv.setXY(i, p[u] / MM_POR_TEXTURA + 0.37 * eixoNormal, p[v] / MM_POR_TEXTURA);
  }
  uv.needsUpdate = true;
  return g;
}
