"""Build a self-contained HTML copy of the static game."""

from pathlib import Path

root = Path(__file__).resolve().parent
output = root / "offline" / "neon-exclusion.html"

html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "styles.css").read_text(encoding="utf-8")
# The downloadable copy must work without an internet connection.
css = "\n".join(line for line in css.splitlines() if not line.lstrip().startswith("@import url('https://fonts.googleapis.com/"))
game = (root / "game.js").read_text(encoding="utf-8")
main = (root / "main.js").read_text(encoding="utf-8")

assert game.count("export function mountGame") == 1
assert main.count("import { mountGame } from './game.js?v=3.1';") == 1
game = game.replace("export function mountGame", "function mountGame", 1)
main = main.replace("import { mountGame } from './game.js?v=3.1';", "", 1)

assert "</script" not in (game + main).lower()
assert "</style" not in css.lower()

style_tag = f"<style>\n{css}\n</style>"
script_tag = f"<script>\n{game}\n{main}\n</script>"
html = html.replace('<link rel="stylesheet" href="./styles.css?v=3.1" />', style_tag, 1)
html = html.replace('<script type="module" src="./main.js?v=3.1"></script>', '', 1)
html = html.replace('</body>', f'{script_tag}\n  </body>', 1)
assert 'src="./main.js' not in html
assert 'href="./styles.css' not in html

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding="utf-8")
print(output)
