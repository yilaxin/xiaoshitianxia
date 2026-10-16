"""Package the existing logo inside a rounded Windows icon container."""
from pathlib import Path
from PIL import Image, ImageDraw


def build_icon(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    artwork = Image.open(source).convert('RGBA')
    # Match the app's logo framing; retain the original artwork and lettering.
    side = min(artwork.size) / 1.63
    left = (artwork.width - side) / 2
    top = (artwork.height - side) / 2
    art = artwork.resize((960, 960), Image.Resampling.LANCZOS,
                         box=(left, top, left + side, top + side))
    mask = Image.new('L', (3840, 3840), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 3839, 3839), radius=864, fill=255)
    art.putalpha(mask.resize((960, 960), Image.Resampling.LANCZOS))
    icon = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    icon.alpha_composite(art, (32, 32))
    icon.save(destination / 'app.png')
    sizes = [(n, n) for n in (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)]
    frames = []
    for size in sizes:
        frame = icon.resize(size, Image.Resampling.LANCZOS)
        frame.putalpha(frame.getchannel('A').point(lambda alpha: 0 if alpha < 4 else alpha))
        frames.append(frame)
    frames[-1].save(destination / 'app.ico', format='ICO', sizes=sizes,
                    append_images=frames[:-1])


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    build_icon(root / 'assets/logo.png', root / 'dist-app')
    print('Rounded Windows icon ready')
