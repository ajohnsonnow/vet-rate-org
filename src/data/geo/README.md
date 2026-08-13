# World boundary data

`world-countries-110m.topo.json` is `countries-110m.json` out of the
`world-atlas@2.0.2` npm package (110m = 1:110,000,000 scale — appropriate for
a whole-world overview map, not zoomed detail), pretty-printed by this repo's
own `prettier --write` pass on commit rather than left as the source's
minified single line.

- **Source package:** [`world-atlas`](https://www.npmjs.com/package/world-atlas) v2.0.2, published by Mike Bostock.
- **Obtained:** `npm pack world-atlas@2.0.2` → extracted `package/countries-110m.json` from the tarball. `world-atlas` itself is NOT an installed dependency (it unpacks to ~8.2 MB for the one file this app needs); only this single vendored file is committed.
- **Size:** the source file is ~108 KB minified; as committed here (pretty-printed, 10,767 lines) it's ~196 KB on disk. Whether Vite's JSON-import bundling strips that formatting whitespace from the production bundle hasn't been verified — treat the shipped bundle-size impact as unconfirmed, not as ~108 KB.
- **Date obtained:** 2026-08-08.
- **License:** ISC (Copyright 2013-2019 Michael Bostock) — see the package's own LICENSE text, reproduced below.
- **Underlying geographic data:** [Natural Earth](https://www.naturalearthdata.com/) — Natural Earth data is in the public domain ("No permission is needed to use Natural Earth. Crediting the authors is unnecessary.").

Consumed via `topojson-client`'s `feature()` at load time
(`src/components/DutyStationMap.jsx`) to produce a GeoJSON
`FeatureCollection` of 177 country geometries, each carrying a
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
