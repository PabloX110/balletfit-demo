"""Convierte assets/img/logo_balletfit.jpg en SVG por capas (cuerpo, brazo, cabeza, ballet, fit).

Uso:  python tools/trace_logo.py   (desde la carpeta balletfit_web)
Genera: assets/img/logo.svg, logo_light.svg, mark.svg, logo_paths.svg
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure

IMG = Path(__file__).resolve().parent.parent / "assets" / "img"
im = np.asarray(Image.open(IMG / "logo_balletfit.jpg").convert("RGB")).astype(float)
x0, y0, x1, y1 = 50, 580, 1550, 1020
a = im[y0:y1, x0:x1]
r, g = a[..., 0], a[..., 1]

# Separar tinta malva y tinta gris carbón
am = np.clip((r - g - 2) / 27, 0, 1)
ad = np.clip((255 - g - am * 111) / 211, 0, 1)
ad = np.clip((ad - 0.15) / 0.85, 0, 1)
ad[am > 0.35] = 0

H, W = am.shape
X = np.arange(W)[None, :] + x0
Y = np.arange(H)[:, None] + y0
mark = X < 400

# Rellenar el cuerpo detrás del brazo, interpolando sus bordes fila por fila
body = ad * mark
L = np.full(H, np.nan)
R = np.full(H, np.nan)
occluded = np.zeros(H, bool)
for y in range(H):
    cols = np.where(body[y, :350] > 0.5)[0]
    arm_cols = np.where(am[y, :350] > 0.2)[0]
    if len(cols):
        L[y], R[y] = cols.min(), cols.max()
    if len(cols) and len(arm_cols) and ((arm_cols >= cols.min() - 3) & (arm_cols <= cols.max() + 3)).any():
        occluded[y] = True
ys = np.arange(H)
has = ~np.isnan(L)
first, last = ys[has].min(), ys[has].max()
inside = (ys > first) & (ys < last)
unknown = ndimage.binary_dilation(occluded, iterations=6) | (inside & ~has)
known = has & ~unknown
Li = np.interp(ys, ys[known], L[known])
Ri = np.interp(ys, ys[known], R[known])
xs = np.arange(350)
for y in ys[unknown & inside]:
    fill = np.clip(np.minimum(xs - Li[y] + 1, Ri[y] - xs + 1), 0, 1)
    body[y, :350] = np.maximum(body[y, :350], fill)

layers = {
    "body": body,
    "arm": am * mark * (Y >= 690),
    "head": am * mark * (Y < 690),
    "ballet": ad * (~mark),
    "fit": am * (~mark),
}


def path_for(alpha, tol=0.6):
    a2 = np.pad(ndimage.gaussian_filter(alpha, 0.7), 2)
    parts = []
    for c in measure.find_contours(a2, 0.5):
        if len(c) < 12:
            continue
        c = measure.approximate_polygon(c, tol)
        parts.append("M" + " ".join(f"{p[1] - 2:.1f},{p[0] - 2:.1f}" for p in c) + "Z")
    return "".join(parts)


fills = {"body": "var(--ink)", "ballet": "var(--ink)", "arm": "var(--mauve)", "head": "var(--mauve)", "fit": "var(--mauve)"}
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="balletfit">']
for k in ["body", "arm", "head", "ballet", "fit"]:
    svg.append(f'<path id="bf-{k}" fill-rule="evenodd" fill="{fills[k]}" d="{path_for(layers[k])}"/>')
svg.append("</svg>")
s = "\n".join(svg)
(IMG / "logo_paths.svg").write_text(s, encoding="utf-8")
std = s.replace("var(--ink)", "#2d2d2e").replace("var(--mauve)", "#af909f")
(IMG / "logo.svg").write_text(std, encoding="utf-8")
(IMG / "logo_light.svg").write_text(std.replace("#2d2d2e", "#f6eff2"), encoding="utf-8")
m = re.sub(r'<path id="bf-(ballet|fit)"[^>]*/>\n?', "", std).replace(f'viewBox="0 0 {W} {H}"', f'viewBox="0 0 330 {H}"')
(IMG / "mark.svg").write_text(m, encoding="utf-8")
print("body subpaths:", path_for(body).count("Z"))
