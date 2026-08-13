# World boundary data

`world-countries-50m.topo.json` is `countries-50m.json` out of the
`world-atlas@2.0.2` npm package (50m = 1:50,000,000 scale), committed exactly
as extracted from the package — `.prettierignore` excludes it so this repo's
own commit-time formatting pass can't silently reformat it (that's what
happened to this file's 110m predecessor: an accidental prettier pass nearly
doubled its committed size for no benefit, since nobody manually reads or
diffs a topology file).

Upgraded from the original 110m (1:110,000,000) dataset because several real
duty-station locations — Kadena AB (Okinawa/Japan), Andersen AFB (Guam), NSA
Bahrain, Diego Garcia — either resolved to no country at all ("At sea") or
were missing from the country picker entirely at 110m resolution. At 50m,
Kadena/Guam/Diego Garcia now resolve correctly; Bahrain still has a
narrow coastal-precision miss for some coordinates even at this resolution
(Bahrain's own polygon exists in the data, a specific point near its coast
can still fall just outside the simplified boundary) — a smaller, different
residual limitation than "missing from the dataset."

- **Source package:** [`world-atlas`](https://www.npmjs.com/package/world-atlas) v2.0.2, published by Mike Bostock.
- **Obtained:** `npm pack world-atlas@2.0.2` → extracted `package/countries-50m.json` from the tarball. `world-atlas` itself is NOT an installed dependency (it unpacks to ~8.2 MB for the one file this app needs); only this single vendored file is committed.
- **Size:** 756,420 bytes (~739 KB) raw, minified, on disk — matches the source exactly, byte for byte. Gzips to ~227 KB, which is what's actually transferred (the map is lazy-loaded, so this only downloads when a veteran opens the Service tab).
- **Date obtained:** 2026-08-13 (50m upgrade; originally obtained 2026-08-08 at 110m resolution).
- **License:** ISC (Copyright 2013-2019 Michael Bostock) — see the package's own LICENSE text, reproduced below.
- **Underlying geographic data:** [Natural Earth](https://www.naturalearthdata.com/) — Natural Earth data is in the public domain ("No permission is needed to use Natural Earth. Crediting the authors is unnecessary.").

Consumed via `topojson-client`'s `feature()` at load time
(`src/components/DutyStationMap.jsx`) to produce a GeoJSON
`FeatureCollection` of 241 country geometries, each carrying a
`properties.name`.

## world-atlas LICENSE text

```
Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```
