"""Generate a 512x512 source PNG for Tauri icon generation (stdlib only)."""

import struct
import zlib
import math

def create_png(width: int, height: int, pixels: list[tuple[int, int, int]]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        payload = tag + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))

    raw_rows = b""
    idx = 0
    for y in range(height):
        raw_rows += b"\x00"
        for x in range(width):
            r, g, b = pixels[idx]
            raw_rows += bytes([r, g, b])
            idx += 1

    idat = chunk(b"IDAT", zlib.compress(raw_rows, level=6))
    iend = chunk(b"IEND", b"")
    return signature + ihdr + idat + iend


def make_icon(size: int = 512) -> bytes:
    """
    Simple Lumina icon: deep navy background with a bright blue radial gradient
    circle and a white 'L' lettermark.
    """
    pixels: list[tuple[int, int, int]] = []
    cx, cy = size / 2, size / 2
    r_outer = size * 0.46
    r_inner = size * 0.38

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)

            if dist > r_outer:
                # Background: deep navy
                pixels.append((10, 14, 31))
            elif dist > r_inner:
                # Outer ring: gradient from indigo to bright blue
                t = (dist - r_inner) / (r_outer - r_inner)
                r = int(99 * t + 59 * (1 - t))
                g = int(102 * t + 130 * (1 - t))
                b = int(241 * t + 246 * (1 - t))
                pixels.append((r, g, b))
            else:
                # Inner circle: solid blue
                pixels.append((59, 130, 246))

    # Draw a simple "L" lettermark on the inner circle
    lx = int(cx - size * 0.10)
    ly_top = int(cy - size * 0.18)
    ly_bot = int(cy + size * 0.18)
    lx_end = int(cx + size * 0.12)
    stroke = max(2, size // 32)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            if math.sqrt(dx * dx + dy * dy) > r_inner:
                continue
            # Vertical bar of L
            if lx <= x <= lx + stroke and ly_top <= y <= ly_bot:
                pixels[y * size + x] = (255, 255, 255)
            # Horizontal bar of L
            if lx <= x <= lx_end and ly_bot - stroke <= y <= ly_bot:
                pixels[y * size + x] = (255, 255, 255)

    return create_png(size, size, pixels)


if __name__ == "__main__":
    import sys
    out_path = sys.argv[1] if len(sys.argv) > 1 else "src-tauri/icon-source.png"
    data = make_icon(512)
    with open(out_path, "wb") as f:
        f.write(data)
    print(f"Written {len(data)} bytes to {out_path}")
