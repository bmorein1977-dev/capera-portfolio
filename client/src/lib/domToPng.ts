// Turn a piece of the page into a PNG picture using only what the browser provides (no library). The element is copied with every style written into it,
// wrapped in an SVG, drawn onto a canvas at twice the size and saved. Web fonts that are loaded from another address are not carried into the picture,
// so text falls back to the browser's plain sans-serif; everything else (colours, charts, layout) is as on screen.
export async function elementToPngBlob(node: HTMLElement, scale = 2, background = "#ffffff"): Promise<Blob> {
  const width = Math.ceil(node.scrollWidth), height = Math.ceil(node.scrollHeight);
  const clone = node.cloneNode(true) as HTMLElement;
  const from = [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))];
  const to = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  from.forEach((src, i) => {
    const dst = to[i]; if (!dst) return;
    const cs = getComputedStyle(src);
    let css = "";
    for (const p of Array.from(cs)) css += `${p}:${cs.getPropertyValue(p)};`;
    dst.setAttribute("style", css);
  });
  clone.style.width = `${width}px`; clone.style.height = `${height}px`; clone.style.margin = "0";
  const xhtml = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("The picture could not be drawn")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The picture could not be drawn");
  ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("The picture could not be saved"))), "image/png"));
}
