"""Render the README illustrations for the plugin.

Run with the bundled Python (Pillow is required):

    python assets/src/render_assets.py

Draws at 2x and downsamples for clean edges. Fonts are the Windows Segoe UI
family; the script is therefore Windows-only, like the plugin.
"""

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

FONTS = {
    "regular": "segoeui.ttf",
    "semibold": "seguisb.ttf",
    "bold": "segoeuib.ttf",
    "light": "segoeuisl.ttf",
    "mono": "consola.ttf",
    "monob": "consolab.ttf",
}

BG_TOP = (9, 11, 17)
BG_BOTTOM = (19, 24, 36)
CARD = (20, 25, 35)
CARD_EDGE = (40, 48, 64)
PANEL = (15, 19, 27)
TEXT = (233, 238, 248)
MUTED = (142, 152, 172)
DIM = (101, 110, 128)
BLUE = (79, 140, 255)
GREEN = (31, 186, 128)
AMBER = (240, 179, 74)
RED = (232, 94, 94)
WINDOW = (29, 32, 39)
TITLEBAR = (37, 41, 50)
SIDEBAR = (23, 26, 32)
BUBBLE = (39, 45, 58)
BUBBLE_BLUE = (30, 59, 94)


def px(value):
    return int(round(value * S))


def font(size, weight="regular"):
    return ImageFont.truetype(os.path.join(FONT_DIR, FONTS[weight]), px(size))


def text(draw, xy, value, face, fill, anchor="la"):
    draw.text((px(xy[0]), px(xy[1])), value, font=face, fill=fill, anchor=anchor)


def text_width(draw, value, face):
    return draw.textlength(value, font=face) / S


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(
        [px(box[0]), px(box[1]), px(box[0] + box[2]), px(box[1] + box[3])],
        radius=px(radius),
        fill=fill,
        outline=outline,
        width=px(width),
    )


def canvas(width, height):
    image = Image.new("RGBA", (px(width), px(height)), (0, 0, 0, 255))
    return image, ImageDraw.Draw(image)


def background(image, width, height):
    draw = ImageDraw.Draw(image)
    for y in range(px(height)):
        t = y / px(height)
        color = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        draw.line([(0, y), (px(width), y)], fill=color)

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([px(1020), px(-280), px(1780), px(460)], fill=BLUE + (26,))
    gd.ellipse([px(-260), px(600), px(460), px(1140)], fill=GREEN + (14,))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(px(95))))


def shadows(image, boxes, radius=20, offset=10, blur=26, alpha=120):
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for x, y, w, h in boxes:
        draw.rounded_rectangle(
            [px(x), px(y + offset), px(x + w), px(y + h + offset)],
            radius=px(radius),
            fill=(0, 0, 0, alpha),
        )
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(px(blur))))


def card(draw, box, fill=CARD, edge=CARD_EDGE, radius=20):
    rounded(draw, box, radius, fill=fill, outline=edge, width=1)


def pill(draw, xy, label, color, size=10, height=22, bg=CARD):
    face = font(size, "semibold")
    width = text_width(draw, label, face) + size * 2.2
    fill = tuple(int(color[i] * 0.16 + bg[i] * 0.84) for i in range(3))
    edge = tuple(int(color[i] * 0.55 + bg[i] * 0.45) for i in range(3))
    rounded(draw, (xy[0], xy[1], width, height), height / 2, fill=fill, outline=edge, width=1)
    text(draw, (xy[0] + width / 2, xy[1] + height / 2), label, face, color, anchor="mm")
    return width


def eyebrow(draw, xy, label, color=BLUE):
    face = font(10, "semibold")
    spaced = "  ".join(label.upper())
    text(draw, xy, spaced, face, color)


def chip(draw, xy, label, color, size=10, height=24, bg=(17, 22, 31)):
    face = font(size, "semibold")
    width = text_width(draw, label, face) + size * 1.8
    fill = tuple(int(color[i] * 0.16 + bg[i] * 0.84) for i in range(3))
    edge = tuple(int(color[i] * 0.5 + bg[i] * 0.5) for i in range(3))
    rounded(draw, (xy[0], xy[1], width, height), height / 2, fill=fill, outline=edge, width=1)
    text(draw, (xy[0] + width / 2, xy[1] + height / 2), label, face, color, anchor="mm")
    return width


def window_radius(width, height):
    return max(4, min(10, width * 0.035, height * 0.06))


def window_image(width, height, title="DeepSeek Harness"):
    W, H = px(width), px(height)
    radius = px(window_radius(width, height))
    image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle([0, 0, W - 1, H - 1], radius=radius, fill=TITLEBAR)
    title_height = int(min(max(H * 0.09, px(13)), px(28)))
    draw.rectangle([0, title_height, W - 1, H], fill=WINDOW)

    small = width < 190
    if width > 140:
        text(
            draw,
            (12, title_height / 2 / S),
            title,
            font(max(7, min(10, width * 0.026)), "semibold"),
            (206, 214, 228),
            anchor="lm",
        )

    control_x = width - 13
    control_y = title_height / S / 2
    step = 12 if width > 190 else 10
    if width > 120:
        draw.line(
            [(px(control_x - step * 2 - 3), px(control_y)), (px(control_x - step * 2 + 3), px(control_y))],
            fill=(150, 159, 176),
            width=px(1.2),
        )
        draw.rectangle(
            [px(control_x - step - 3), px(control_y - 3), px(control_x - step + 3), px(control_y + 3)],
            outline=(150, 159, 176),
            width=px(1.2),
        )
        draw.line(
            [(px(control_x - 3), px(control_y - 3)), (px(control_x + 3), px(control_y + 3))],
            fill=(150, 159, 176),
            width=px(1.2),
        )
        draw.line(
            [(px(control_x + 3), px(control_y - 3)), (px(control_x - 3), px(control_y + 3))],
            fill=(150, 159, 176),
            width=px(1.2),
        )

    sidebar_width = int(W * 0.22)
    draw.rectangle([0, title_height, sidebar_width, H], fill=SIDEBAR)
    draw.line([(sidebar_width, title_height), (sidebar_width, H)], fill=(45, 52, 66), width=px(1))

    if not small:
        rows = 4
        for index in range(rows):
            row_y = title_height + px(16) + index * px(15)
            row_width = (sidebar_width - px(24)) * (0.86 if index == 0 else 0.62)
            draw.rounded_rectangle(
                [px(11), row_y, px(11) + row_width, row_y + px(5)],
                radius=px(2.5),
                fill=BLUE if index == 0 else (42, 49, 63),
            )

    main_x = sidebar_width + px(13)
    main_width = W - main_x - px(13)

    draw.rounded_rectangle(
        [main_x, title_height + px(11), main_x + main_width * 0.46, title_height + px(21)],
        radius=px(3),
        fill=(41, 47, 60),
    )

    bubble_top = title_height + px(34)
    draw.rounded_rectangle(
        [main_x, bubble_top, main_x + main_width * 0.66, bubble_top + px(26)],
        radius=px(5),
        fill=BUBBLE,
    )
    draw.rounded_rectangle(
        [main_x + main_width * 0.36, bubble_top + px(33), main_x + main_width, bubble_top + px(55)],
        radius=px(5),
        fill=BUBBLE_BLUE,
    )
    draw.rounded_rectangle(
        [main_x, bubble_top + px(62), main_x + main_width * 0.55, bubble_top + px(84)],
        radius=px(5),
        fill=BUBBLE,
    )

    input_y = H - px(24)
    draw.rounded_rectangle(
        [main_x, input_y, W - px(12), input_y + px(15)],
        radius=px(7),
        fill=(27, 32, 42),
        outline=(52, 61, 78),
        width=px(1),
    )
    draw.ellipse(
        [W - px(28), input_y + px(3), W - px(20), input_y + px(11)],
        fill=BLUE,
    )

    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], radius=radius, fill=255)
    image.putalpha(mask)
    return image


def paste_window(image, box, title="DeepSeek Harness"):
    x, y, w, h = box
    image.alpha_composite(window_image(w, h, title), (px(x), px(y)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        [px(x), px(y), px(x + w), px(y + h)],
        radius=px(window_radius(w, h)),
        outline=(58, 67, 86),
        width=px(1),
    )


def screen(image, box, taskbar=True):
    x, y, w, h = box
    W, H = px(w), px(h)
    wallpaper = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    wd = ImageDraw.Draw(wallpaper)
    for row in range(H):
        t = row / H
        color = (
            int(21 + 8 * t),
            int(31 + 10 * t),
            int(50 + 10 * t),
        )
        wd.line([(0, row), (W, row)], fill=color)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([int(W * 0.42), -int(H * 0.55), int(W * 1.25), int(H * 0.72)], fill=BLUE + (30,))
    gd.ellipse([-int(W * 0.25), int(H * 0.55), int(W * 0.55), int(H * 1.4)], fill=GREEN + (16,))
    wallpaper.alpha_composite(glow.filter(ImageFilter.GaussianBlur(px(26))))

    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], radius=px(12), fill=255)
    image.paste(wallpaper, (px(x), px(y)), mask)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        [px(x), px(y), px(x + w), px(y + h)],
        radius=px(12),
        outline=(44, 53, 70),
        width=px(1),
    )

    if taskbar:
        bar_height = 18
        draw.rectangle([px(x), px(y + h - bar_height), px(x + w), px(y + h)], fill=(10, 13, 19))
        dot_x = x + w / 2
        for offset in (-10, 0, 10):
            draw.ellipse(
                [px(dot_x + offset - 2.4), px(y + h - 10), px(dot_x + offset + 2.4), px(y + h - 5.2)],
                fill=(64, 74, 94),
            )
        text(
            draw,
            (x + w - 12, y + h - 9),
            "17:45",
            font(7),
            (150, 160, 178),
            anchor="rm",
        )


def dashed_rect(draw, box, color=DIM, dash=6, gap=5, width=1.2):
    x, y, w, h = box
    for start in range(0, int(w), dash + gap):
        end = min(start + dash, w)
        draw.line([(px(x + start), px(y)), (px(x + end), px(y))], fill=color, width=px(width))
        draw.line([(px(x + start), px(y + h)), (px(x + end), px(y + h))], fill=color, width=px(width))
    for start in range(0, int(h), dash + gap):
        end = min(start + dash, h)
        draw.line([(px(x), px(y + start)), (px(x), px(y + end))], fill=color, width=px(width))
        draw.line([(px(x + w), px(y + start)), (px(x + w), px(y + end))], fill=color, width=px(width))


def chevron(draw, x, y, size=7, color=(92, 104, 127), width=1.6):
    draw.line([(px(x - size), px(y - size)), (px(x + size), px(y))], fill=color, width=px(width))
    draw.line([(px(x + size), px(y)), (px(x - size), px(y + size))], fill=color, width=px(width))


def check(draw, x, y, radius=10, color=GREEN):
    draw.ellipse([px(x - radius), px(y - radius), px(x + radius), px(y + radius)], fill=color)
    draw.line(
        [(px(x - radius * 0.45), px(y)), (px(x - radius * 0.08), px(y + radius * 0.36)), (px(x + radius * 0.5), px(y - radius * 0.38))],
        fill=(12, 20, 16),
        width=px(2),
    )


def dimension(draw, x1, x2, y, label, color=DIM):
    draw.line([(px(x1), px(y)), (px(x2), px(y))], fill=color, width=px(1))
    draw.line([(px(x1), px(y - 4)), (px(x1), px(y + 4))], fill=color, width=px(1))
    draw.line([(px(x2), px(y - 4)), (px(x2), px(y + 4))], fill=color, width=px(1))
    text(draw, ((x1 + x2) / 2, y - 4), label, font(8, "mono"), color, anchor="ms")


def save(image, name):
    target = os.path.join(OUT, name)
    final = image.convert("RGB").resize((image.width // S, image.height // S), Image.LANCZOS)
    final.save(target, optimize=True)
    print(f"{name}: {final.width}x{final.height}")


def render_hero():
    width, height = 1600, 900
    image, draw = canvas(width, height)
    background(image, width, height)

    card_boxes = [(64, 258, 700, 520), (836, 258, 700, 520)]
    shadows(image, card_boxes, radius=22, offset=14, blur=30, alpha=130)
    draw = ImageDraw.Draw(image)

    eyebrow(draw, (64, 54), "DSH Desktop · Windows")
    text(draw, (64, 82), "The window you left", font(46, "bold"), TEXT)
    text(draw, (64, 138), "is the window you get.", font(46, "bold"), BLUE)
    text(
        draw,
        (64, 206),
        "Size, position and maximized state are restored before the window is painted.",
        font(16),
        MUTED,
    )

    text(draw, (64, 236), "Windows 10/11  ·  DSH Desktop 0.2.1-rc.3", font(10.5, "mono"), DIM)

    for box in card_boxes:
        card(draw, box)

    # Left card: default every launch
    lx, ly, lw, lh = card_boxes[0]
    text(draw, (lx + 28, ly + 24), "WITHOUT IT", font(10, "semibold"), DIM)
    text(draw, (lx + 28, ly + 44), "Default every launch", font(20, "semibold"), TEXT)
    pill(draw, (lx + 560, ly + 34), "RESET", AMBER, size=9, height=20)
    screen(image, (lx + 28, ly + 96, lw - 56, 330))
    paste_window(image, (lx + 200, ly + 158, 300, 200))
    text(draw, (lx + 28, ly + 446), "1280 × 820  ·  default position", font(11, "mono"), MUTED)
    text(draw, (lx + 28, ly + 470), "You fix it again on every start.", font(14), DIM)

    # Right card: restored
    rx, ry, rw, rh = card_boxes[1]
    text(draw, (rx + 28, ry + 24), "WITH THIS PLUGIN", font(10, "semibold"), BLUE)
    text(draw, (rx + 28, ry + 44), "Exactly where you left it", font(20, "semibold"), TEXT)
    pill(draw, (rx + 528, ry + 34), "RESTORED", GREEN, size=9, height=20)
    screen(image, (rx + 28, ry + 96, rw - 56, 330))
    paste_window(image, (rx + 74, ry + 118, 470, 270))
    text(draw, (rx + 28, ly + 446), "1943 × 1323  ·  at (−2280, 43)", font(11, "mono"), MUTED)
    text(draw, (rx + 28, ly + 470), "Restored on the same display, maximized if it was.", font(14), DIM)

    text(draw, (64, 836), "Offline  ·  no telemetry  ·  no extra process", font(11), DIM)
    text(draw, (1536, 836), "windows only", font(10, "mono"), DIM, anchor="ra")
    save(image, "hero.png")


def render_lifecycle():
    width, height = 1600, 620
    image, draw = canvas(width, height)
    background(image, width, height)

    boxes = [(60 + index * 380, 190, 340, 310) for index in range(4)]
    shadows(image, boxes, radius=20, offset=12, blur=26, alpha=120)
    draw = ImageDraw.Draw(image)

    eyebrow(draw, (60, 46), "Lifecycle")
    text(draw, (60, 72), "Closed is not lost.", font(40, "bold"), TEXT)
    text(draw, (60, 126), "Move it, close DSH, open it again — the window is already there.", font(15), MUTED)

    steps = [
        ("01", "Move & resize", "Drag, snap or maximize. Detected within a second."),
        ("02", "Saved silently", "An atomic JSON file in your DSH home."),
        ("03", "Close DSH", "Quit, crash or tray hide — the last state is safe."),
        ("04", "Reopen", "Restored while the window is still hidden."),
    ]

    for index, (number, title, caption) in enumerate(steps):
        bx, by, bw, bh = boxes[index]
        card(draw, (bx, by, bw, bh))
        text(draw, (bx + 24, by + 22), number, font(11, "mono"), BLUE)

        icon = (bx + 24, by + 52, bw - 48, 132)
        if index == 0:
            rounded(draw, icon, 12, fill=PANEL, outline=(42, 50, 64))
            paste_window(image, (bx + 100, by + 70, 140, 90))
            draw = ImageDraw.Draw(image)
            draw.line([(px(bx + 122), px(by + 172)), (px(bx + 214), px(by + 172))], fill=BLUE, width=px(1.4))
            draw.line([(px(bx + 122), px(by + 172)), (px(bx + 129), px(by + 167))], fill=BLUE, width=px(1.4))
            draw.line([(px(bx + 122), px(by + 172)), (px(bx + 129), px(by + 177))], fill=BLUE, width=px(1.4))
            draw.line([(px(bx + 214), px(by + 172)), (px(bx + 207), px(by + 167))], fill=BLUE, width=px(1.4))
            draw.line([(px(bx + 214), px(by + 172)), (px(bx + 207), px(by + 177))], fill=BLUE, width=px(1.4))
            draw.line([(px(bx + 232), px(by + 162)), (px(bx + 244), px(by + 162))], fill=BLUE, width=px(1.4))
            draw.line([(px(bx + 244), px(by + 150)), (px(bx + 244), px(by + 162))], fill=BLUE, width=px(1.4))
        elif index == 1:
            rounded(draw, icon, 12, fill=PANEL, outline=(42, 50, 64))
            rounded(draw, (bx + 66, by + 72, 208, 96), 8, fill=(12, 16, 23), outline=(48, 58, 76))
            for row, line in enumerate(['"x": -2280,', '"width": 1943,', '"maximized": false']):
                text(draw, (bx + 82, by + 86 + row * 22), line, font(8.5, "mono"), (152, 164, 185))
            check(draw, bx + 282, by + 77, radius=9)
        elif index == 2:
            rounded(draw, icon, 12, fill=PANEL, outline=(42, 50, 64))
            paste_window(image, (bx + 92, by + 76, 156, 100))
            draw = ImageDraw.Draw(image)
            draw.ellipse([px(bx + 252), px(by + 114), px(bx + 292), px(by + 154)], fill=(28, 20, 24), outline=RED, width=px(1.4))
            draw.line([(px(bx + 264), px(by + 126)), (px(bx + 280), px(by + 142))], fill=RED, width=px(2))
            draw.line([(px(bx + 280), px(by + 126)), (px(bx + 264), px(by + 142))], fill=RED, width=px(2))
        else:
            rounded(draw, icon, 12, fill=PANEL, outline=(42, 50, 64))
            paste_window(image, (bx + 84, by + 76, 172, 104))
            check(draw, bx + 300, by + 64, radius=11)

        text(draw, (bx + 24, by + 196), title, font(18, "semibold"), TEXT)
        text(draw, (bx + 24, by + 226), caption, font(12.5), MUTED)

        if index < 3:
            chevron(draw, bx + bw + 20, by + 155, size=6, color=(88, 100, 122), width=1.6)

    text(draw, (800, 548), "No prompts.  No settings.  No background service.", font(12), DIM, anchor="mm")
    save(image, "lifecycle.png")


def render_states():
    width, height = 1600, 760
    image, draw = canvas(width, height)
    background(image, width, height)

    boxes = [(70 + index * 500, 176, 460, 492) for index in range(3)]
    shadows(image, boxes, radius=20, offset=12, blur=26, alpha=120)
    draw = ImageDraw.Draw(image)

    eyebrow(draw, (70, 46), "Window states")
    text(draw, (70, 72), "Normal, maximized, minimized.", font(40, "bold"), TEXT)
    text(draw, (70, 126), "All three survive a quit — including minimizing right before you close.", font(15), MUTED)

    # Normal
    bx, by, bw, bh = boxes[0]
    card(draw, (bx, by, bw, bh))
    pill(draw, (bx + 24, by + 24), "NORMAL", BLUE, size=9, height=20)
    text(draw, (bx + 24, by + 56), "Remembers the frame", font(18, "semibold"), TEXT)
    screen(image, (bx + 24, by + 94, bw - 48, 250))
    paste_window(image, (bx + 66, by + 118, 318, 204))
    text(draw, (bx + 24, by + 366), "1943 × 1323 at (−2280, 43)", font(11, "mono"), MUTED)
    text(draw, (bx + 24, by + 392), "Position and size come back exactly as", font(12.5), DIM)
    text(draw, (bx + 24, by + 410), "they were left, on the same display.", font(12.5), DIM)

    # Maximized
    bx, by, bw, bh = boxes[1]
    card(draw, (bx, by, bw, bh))
    pill(draw, (bx + 24, by + 24), "MAXIMIZED", GREEN, size=9, height=20)
    text(draw, (bx + 24, by + 56), "Keeps the maximized flag", font(18, "semibold"), TEXT)
    screen(image, (bx + 24, by + 94, bw - 48, 250), taskbar=False)
    paste_window(image, (bx + 30, by + 100, bw - 60, 238))
    text(draw, (bx + 24, by + 366), "showCmd = SW_SHOWMAXIMIZED", font(11, "mono"), MUTED)
    text(draw, (bx + 24, by + 392), "The window fills the work area on the", font(12.5), DIM)
    text(draw, (bx + 24, by + 410), "same monitor, without a visible resize.", font(12.5), DIM)

    # Minimized before quit
    bx, by, bw, bh = boxes[2]
    card(draw, (bx, by, bw, bh))
    pill(draw, (bx + 24, by + 24), "MINIMIZED → QUIT", AMBER, size=9, height=20)
    text(draw, (bx + 24, by + 56), "Still maximized on reopen", font(18, "semibold"), TEXT)
    rounded(draw, (bx + 24, by + 96, bw - 48, 48), 10, fill=(13, 17, 24), outline=(44, 53, 70))
    rounded(draw, (bx + 38, by + 104, 170, 32), 8, fill=(18, 22, 30), outline=(48, 57, 73))
    rounded(draw, (bx + 48, by + 112, 14, 14), 4, fill=BLUE)
    text(draw, (bx + 70, by + 120), "DeepSeek Harness", font(8), (196, 205, 220), anchor="lm")
    draw.line([(px(bx + 186), px(by + 120)), (px(bx + 196), px(by + 120))], fill=(150, 160, 178), width=px(1.4))
    text(draw, (bx + 222, by + 120), "minimized", font(11, "mono"), AMBER, anchor="lm")
    chevron(draw, bx + bw / 2, by + 168, size=5, color=AMBER, width=1.6)
    screen(image, (bx + 24, by + 186, bw - 48, 158), taskbar=False)
    paste_window(image, (bx + 30, by + 192, bw - 60, 146))
    check(draw, bx + bw - 34, by + 38, radius=11)
    text(draw, (bx + 24, by + 366), "minimized ≠ not maximized", font(11, "mono"), MUTED)
    text(draw, (bx + 24, by + 392), "The last visible state is kept, so the", font(12.5), DIM)
    text(draw, (bx + 24, by + 410), "window comes back maximized, not small.", font(12.5), DIM)

    text(draw, (800, 716), "The maximized flag is remembered through minimize and tray hide.", font(11.5), DIM, anchor="mm")
    save(image, "states.png")


def render_multimonitor():
    width, height = 1600, 720
    image, draw = canvas(width, height)
    background(image, width, height)

    eyebrow(draw, (90, 46), "Multi-monitor")
    text(draw, (90, 72), "Two displays, one remembered place.", font(40, "bold"), TEXT)
    text(draw, (90, 126), "Negative coordinates are valid, preserved, and clamped only when a display disappears.", font(15), MUTED)

    left_screen = (90, 190, 640, 360)
    right_screen = (870, 190, 640, 360)
    shadows(image, [left_screen, right_screen], radius=16, offset=10, blur=24, alpha=90)
    draw = ImageDraw.Draw(image)

    screen(image, left_screen, taskbar=True)
    screen(image, right_screen, taskbar=True)
    draw = ImageDraw.Draw(image)

    paste_window(image, (168, 238, 476, 268))
    draw = ImageDraw.Draw(image)
    chip(draw, (100, 200), "x = −2280  ·  y = 43", AMBER, size=10, height=24)
    saved_label = "saved  ·  1943 × 1323"
    saved_width = text_width(draw, saved_label, font(10, "semibold")) + 18
    chip(draw, (730 - 10 - saved_width, 200), saved_label, GREEN, size=10, height=24)
    chip(draw, (884, 200), "primary", DIM, size=10, height=24)

    text(draw, (90, 562), "DISPLAY 1  ·  −2560, 0", font(11, "mono"), MUTED)
    text(draw, (1510, 562), "DISPLAY 2  ·  primary", font(10, "mono"), MUTED, anchor="ra")

    rounded(draw, (90, 606, 1420, 70), 14, fill=(17, 22, 31), outline=(40, 48, 63))
    check(draw, 122, 641, radius=12)
    text(draw, (148, 626), "Saved on the left display", font(14, "semibold"), TEXT)
    text(
        draw,
        (148, 646),
        "If that display is gone next time, the window moves into the nearest work area and shrinks to fit.",
        font(11.5),
        MUTED,
    )
    save(image, "multimonitor.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    render_hero()
    render_lifecycle()
    render_states()
    render_multimonitor()


if __name__ == "__main__":
    main()

