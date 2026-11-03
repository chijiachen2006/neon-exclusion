"""Build a self-contained HTML copy of the static game."""

from pathlib import Path
import base64
import re

root = Path(__file__).resolve().parent
output = root / "offline" / "neon-exclusion.html"

html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "styles.css").read_text(encoding="utf-8")
# The downloadable copy must work without an internet connection.
css = "\n".join(line for line in css.splitlines() if not line.lstrip().startswith("@import url('https://fonts.googleapis.com/"))
game = (root / "game.js").read_text(encoding="utf-8")
main = (root / "main.js").read_text(encoding="utf-8")

# Keep the downloadable version fully self-contained, including rendered art.
for asset_name in ("arena-ice.png", "units-ice.png", "rover-hero.png", "rover-layered.png", "enemies-layered-a.png", "enemies-layered-b.png"):
    asset = root / "assets" / asset_name
    data_url = "data:image/png;base64," + base64.b64encode(asset.read_bytes()).decode("ascii")
    asset_url = f"./assets/{asset_name}?v=3.5"
    css = css.replace(asset_url, data_url)
    game = game.replace(asset_url, data_url)
html = re.sub(r'^\s*<link rel="preload"[^>]*>\s*$', '', html, flags=re.MULTILINE)

assert game.count("export function mountGame") == 1
assert main.count("import { mountGame } from './game.js?v=3.5';") == 1
game = game.replace("export function mountGame", "function mountGame", 1)
main = main.replace("import { mountGame } from './game.js?v=3.5';", "", 1)

assert "</script" not in (game + main).lower()
assert "</style" not in css.lower()

style_tag = f"<style>\n{css}\n</style>"
script_tag = f"<script>\n{game}\n{main}\n</script>"
html = html.replace('<link rel="stylesheet" href="./styles.css?v=3.5" />', style_tag, 1)
html = html.replace('<script type="module" src="./main.js?v=3.5"></script>', '', 1)
html = html.replace('</body>', f'{script_tag}\n  </body>', 1)
assert 'src="./main.js' not in html
assert 'href="./styles.css' not in html
assert "./assets/arena-ice.png" not in html
assert "./assets/units-ice.png" not in html
assert "./assets/rover-hero.png" not in html
assert "./assets/rover-layered.png" not in html
assert "./assets/enemies-layered-" not in html

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding="utf-8")
print(output)
