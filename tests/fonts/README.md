# Font fixtures

The eleven unmodified Noto fonts below are the selected international glyph
fixtures. The set uses the smaller script TTFs and CJK OTFs from the comparison,
plus the supplied static monochrome and scalable SVG color emoji fonts.
Together they occupy 50,212,404 bytes, saving 6,743,332 bytes (11.8%) over the
supplied set while retaining its combined 50,308 mapped Unicode code points.

All twelve fonts, including the SVG regression fixture, are stored as individual
Brotli files compressed at quality 11: 23,807,876 bytes instead of 50,213,464
bytes (52.6% smaller). Decompression restores the original bytes.

| File | Coverage | Source |
| --- | --- | --- |
| [NotoSans-Regular.ttf.br](NotoSans-Regular.ttf.br) | Latin / Greek / Cyrillic | [Pinned download](https://raw.githubusercontent.com/notofonts/notofonts.github.io/42af67ccd12bc0e31ed85384bf73e39248265374/fonts/NotoSans/unhinted/ttf/NotoSans-Regular.ttf) |
| [NotoSansArabic-Regular.ttf.br](NotoSansArabic-Regular.ttf.br) | Arabic | [Pinned download](https://raw.githubusercontent.com/notofonts/notofonts.github.io/42af67ccd12bc0e31ed85384bf73e39248265374/fonts/NotoSansArabic/unhinted/ttf/NotoSansArabic-Regular.ttf) |
| [NotoSansHebrew-Regular.ttf.br](NotoSansHebrew-Regular.ttf.br) | Hebrew | [Pinned download](https://raw.githubusercontent.com/notofonts/notofonts.github.io/42af67ccd12bc0e31ed85384bf73e39248265374/fonts/NotoSansHebrew/unhinted/ttf/NotoSansHebrew-Regular.ttf) |
| [NotoSansDevanagari-Regular.ttf.br](NotoSansDevanagari-Regular.ttf.br) | Devanagari | [Pinned download](https://raw.githubusercontent.com/notofonts/notofonts.github.io/42af67ccd12bc0e31ed85384bf73e39248265374/fonts/NotoSansDevanagari/unhinted/ttf/NotoSansDevanagari-Regular.ttf) |
| [NotoSansThai-Regular.ttf.br](NotoSansThai-Regular.ttf.br) | Thai | [Pinned download](https://raw.githubusercontent.com/notofonts/notofonts.github.io/42af67ccd12bc0e31ed85384bf73e39248265374/fonts/NotoSansThai/unhinted/ttf/NotoSansThai-Regular.ttf) |
| [NotoSansSC-Regular.otf.br](NotoSansSC-Regular.otf.br) | Simplified Chinese | [Pinned download](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf) |
| [NotoSansTC-Regular.otf.br](NotoSansTC-Regular.otf.br) | Traditional Chinese | [Pinned download](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf) |
| [NotoSansJP-Regular.otf.br](NotoSansJP-Regular.otf.br) | Japanese | [Pinned download](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf) |
| [NotoSansKR-Regular.otf.br](NotoSansKR-Regular.otf.br) | Korean | [Pinned download](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf) |
| [NotoEmoji-Regular.ttf.br](NotoEmoji-Regular.ttf.br) | Monochrome emoji | User supplied; Version 3.006 |
| [NotoColorEmoji-Regular.ttf.br](NotoColorEmoji-Regular.ttf.br) | Color emoji | User supplied; Version 2.057;GOOG;noto-emoji:20260911:fc4ca365e7c20e78278ae702aa20434bfe704c8f |

All Noto fixtures use the SIL Open Font License 1.1; copyright notices and the
full license are in [OFL.txt](OFL.txt). Source revisions for the two supplied
emoji files are unknown; [SHA256SUMS](SHA256SUMS) identifies every retained font.

The browser regressions use `NotoSans-Regular.ttf` and `color-svg.ttf`. The other
Noto files are retained for international glyph comparisons.

## SVG regression fixture

[color-svg.ttf.br](color-svg.ttf.br) restores an independently authored, 1,060-byte test font containing
one supplementary Unicode glyph, U+1F600. Its SVG draws a red rectangle next
to a blue rectangle. The empty TrueType outline lets the browser regression
distinguish actual SVG color rendering from a fallback or monochrome glyph.
The fixture is covered by this repository's MIT license; it contains no Noto
font data.

## Extraction

`npm run test:browser` and direct `npx playwright test` runs extract all fonts
into `build/test-fonts` before running tests, even when reusing an existing
server. This uses only Node's built-in Brotli, filesystem, and SHA-256 support.
Every run regenerates the output and verifies each font against `SHA256SUMS`,
which records the uncompressed bytes. Missing or corrupt inputs abort the run.

To extract and verify the fonts without running tests, run this from the repository root:

```sh
node --input-type=module -e "import setup from './scripts/prepare-test-fonts.mjs'; setup();"
```

The output is ignored by Git and removed by `npm run clean`. Test fonts are
excluded from the npm package.
