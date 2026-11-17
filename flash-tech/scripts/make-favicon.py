#!/usr/bin/env python3
"""Render web/app/favicon.ico from the header logo's "F" mark, no external tools.

The mark is not new artwork: it is the same one `web/app/globals.css` draws for
`.logo .mark` — a 30x30 rounded square, `linear-gradient(140deg, #2563eb, #7c3aed)`,
white 800-weight "F". The letter is drawn as three rectangles rather than text so the
pixels do not depend on which font a renderer happens to have.

`web/app/icon.svg` is the same geometry written by hand; this script only exists for the
.ico, which cannot be an SVG. Both are committed, so a build never needs Python.

Output: an ICO with 16, 32, 48 and 64 px entries, 32bpp BMP (the original ICO flavour —
every browser and Windows version reads it; PNG-in-ICO does not work pre-Vista).

Usage: python3 scripts/make-favicon.py [out.ico]
"""
import struct
import sys
from pathlib import Path

# --- geometry, in a 64x64 grid (identical numbers to web/app/icon.svg) --------------
BOX = 64.0
RADIUS = 18.0          # 9/30 of the CSS mark
# The "F": stem + top arm + middle arm. Bounding box 20..44 x 16..48 = centred, 32 tall.
F_RECTS = (
    (20.0, 16.0, 27.0, 48.0),   # stem
    (20.0, 16.0, 44.0, 23.0),   # top arm
    (20.0, 28.0, 39.0, 35.0),   # middle arm
)
ACCENT = (0x25, 0x63, 0xEB)     # --accent
ACCENT_2 = (0x7C, 0x3A, 0xED)   # the purple the mark's gradient runs to
SS = 8                          # supersampling factor per axis


def inside_rounded_square(x, y):
    """Point in unit square [0,1]^2, corner radius RADIUS/BOX."""
    r = RADIUS / BOX
    if x < 0.0 or x > 1.0 or y < 0.0 or y > 1.0:
        return False
    # Distance to the inner rect (the square shrunk by the radius on each side).
    dx = max(r - x, 0.0, x - (1.0 - r))
    dy = max(r - y, 0.0, y - (1.0 - r))
    return dx * dx + dy * dy <= r * r


def inside_f(x, y):
    gx, gy = x * BOX, y * BOX
    for x0, y0, x1, y1 in F_RECTS:
        if x0 <= gx <= x1 and y0 <= gy <= y1:
            return True
    return False


def gradient_at(u, v):
    """CSS `linear-gradient(140deg, accent, accent-2)` sampled at unit coords.

    CSS angles run clockwise from "to top": 140deg points down-right, so the direction
    vector is (sin140, -cos140) with y growing downwards. The gradient line length for a
    box is |w*dx| + |h*dy|, which is what keeps the 0 and 1 stops on the corners.
    """
    import math
    dx, dy = math.sin(math.radians(140)), -math.cos(math.radians(140))
    length = BOX * abs(dx) + BOX * abs(dy)
    # Centre-to-point projection, normalised so the ends of the line are 0 and 1.
    t = (((u - 0.5) * BOX) * dx + ((v - 0.5) * BOX) * dy) / length + 0.5
    t = min(1.0, max(0.0, t))
    return tuple(round(ACCENT[i] + (ACCENT_2[i] - ACCENT[i]) * t) for i in range(3))


def render(size):
    """RGBA pixels, top-down rows, straight alpha."""
    out = []
    step = 1.0 / (size * SS)
    for py in range(size):
        row = []
        v = (py + 0.5) / size
        for px in range(size):
            u = (px + 0.5) / size
            covered = 0
            r = g = b = 0.0
            for sy in range(SS):
                y = (py * SS + sy + 0.5) * step
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) * step
                    if not inside_rounded_square(x, y):
                        continue
                    covered += 1
                    if inside_f(x, y):
                        r += 255.0
                        g += 255.0
                        b += 255.0
                    else:
                        cr, cg, cb = gradient_at(u, v)
                        r += cr
                        g += cg
                        b += cb
            if covered == 0:
                row.append((0, 0, 0, 0))
            else:
                # Colour averaged over the covered subsamples; alpha is the coverage, so the
                # rounded corners fade into the tab background instead of a white halo.
                row.append((
                    round(r / covered),
                    round(g / covered),
                    round(b / covered),
                    round(255 * covered / (SS * SS)),
                ))
        out.append(row)
    return out


def dib(pixels, size):
    """A 32bpp BMP DIB as an ICO stores it: bottom-up BGRA, then a 1bpp AND mask."""
    header = struct.pack(
        "<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, 0, 0, 0, 0, 0
    )
    xor = bytearray()
    for row in reversed(pixels):
        for r, g, b, a in row:
            xor += bytes((b, g, r, a))
    mask_row = ((size + 31) // 32) * 4          # 1bpp rows, padded to 4 bytes
    return header + bytes(xor) + bytes(mask_row * size)


def build_ico(sizes, path):
    images = [(s, dib(render(s), s)) for s in sizes]
    body = bytearray()
    entries = bytearray()
    offset = 6 + 16 * len(images)
    for size, data in images:
        entries += struct.pack(
            "<BBBBHHII",
            0 if size >= 256 else size,  # 0 means 256
            0 if size >= 256 else size,
            0, 0, 1, 32, len(data), offset,
        )
        offset += len(data)
        body += data
    path.write_bytes(struct.pack("<HHH", 0, 1, len(images)) + entries + body)


def main():
    here = Path(__file__).resolve().parent
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else here.parent / "web" / "app" / "favicon.ico"
    build_ico((16, 32, 48, 64), out)
    print(f"wrote {out} ({out.stat().st_size} B, sizes 16/32/48/64)")


if __name__ == "__main__":
    main()
