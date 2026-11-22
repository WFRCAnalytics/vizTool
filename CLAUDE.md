# vizTool

A static (no build step), client-side JS app that visualizes Wasatch Front Travel
Demand Model (TDM) output on maps and trend charts. Plain `<script>` includes, no
bundler/framework. See `README.md` / GitHub wiki for the user-facing description.

## Running it locally

`python _start-server.py` (plain `http.server` on port 8000 + opens Chrome
incognito at `http://localhost:8000/index.html`). `_start-server-static.py` /
`_start-server-model.py` are variants. No install/build step — it's all static
files served as-is.

## Repo layout

- `config/*.json` — all app wiring: menu structure, filter/attribute/aggregator/
  divider definitions, dashboard cards & measures, scenario list. This is what you
  edit to add menu entities, filters, etc. Loaded at startup as globals (`configApp`,
  `configFilters`, `configAttributes`, `configAggregators`, `configDividers`,
  `configCards`, `configMeasures`, `jsonScenario`).
- `geo-data/` — base GeoJSON feature geometries (segments, TAZ, and aggregation-
  boundary variants like `WFv910_TAZ__CITY.geojson`) plus `geo-data/keys/*_KEY.json`
  crosswalks used to roll a base geometry's data up to a coarser aggregator.
- `scenario-data/<modVersion>__<scnGroup>__<scnYear>/j-*.json` — the actual TDM
  export data, one file per "model entity" data source (e.g.
  `j-zone-trip-metrics.json`, `j-zone-facility-metrics.json`). These are produced
  by an external TDM export pipeline (not in this repo) — you don't hand-edit their
  `data` payload, but you do need to understand their schema to wire up `config/`.
- `app/` — the actual JS app. `app/scenarios/scenario.js` loads/caches/aggregates
  scenario-data json; `app/scenarios/attribute-filter-data.js` wraps one parsed
  json file; `app/layouts/*.js` are the view templates (`vizmap.js`, `viztrends.js`,
  `vizmatrix.js`, `measure.js`/dashboard cards, `vizsidebar.js`, `attribute.js`,
  `filter.js`); `app/widgets/*.js` are the sidebar filter widgets (`wijselect.js`,
  `wijcheckboxes.js`, `wijradio.js`).

## Scenario-data JSON schema (`j-*.json`)

Top level: `{ vizToolId, attributes: [...], filters: [...], data: {...} }`.

- `attributes[]`: `{ attributeCode, attributeDescription, roundingDecimals,
  filterGroup, wideFilterSettings, tdmCsvColumn? }`. **Only `filterGroup` is read
  by the app** (`DataAttribute` in `attribute-filter-data.js` ignores
  `wideFilterSettings` entirely — it's export-pipeline-only metadata, currently
  unused by the frontend). `filterGroup` is a `_`-joined string of filter codes,
  e.g. `"fFuncType_fAreaType_fVehTypeFacility_fTod4pDy"`, naming which filter
  dimensions compose that attribute's data-lookup key. An attribute with no
  wide/long filter dependency at all (e.g. a raw zone static count) has an empty
  `filterGroup` / none.
- `filters[]`: `{ filterCode, filterDescription, filterLocation ("long"|"wide"),
  tdmCsvColumn, fOptions: [...] }`. This is just descriptive/export metadata — the
  app does **not** read these `fOptions` for rendering; the actual UI widget
  (checkboxes/select/radio) and its option list/labels come from
  `config/filters.json`, keyed by the same `filterCode` string.
- `data`: flat object keyed by a `_`-joined combo of filter-dimension *values*
  (one segment per dimension in `filterGroup`, in whatever order the export used —
  order doesn't matter at read time, see below), each value an object of
  `{ zoneOrFeatureId: { attributeCode: number, ... } }`. A "long" filter (e.g.
  functional type, area type) becomes one segment per combo; a "wide" filter (e.g.
  vehicle type, time-of-day) is also just another `_`-joined segment in practice —
  the long/wide distinction in the filter metadata doesn't change how the app reads
  the key.

### How the app resolves a combo key (`Scenario.getDataForFilterOptionsList`)

1. Every top-level `data` key is lowercased, split on `_`, sorted, and rejoined —
   this becomes the lookup index. So segment **order in the key doesn't matter**,
   and matching is **case-insensitive**.
2. The sidebar builds the *same* normalized form from the user's current filter
   selections: for each filter dimension relevant to the selected attribute, take
   its selected option value(s); cartesian-product across dimensions
   (`findAllCombinationsOfLists` in `vizsidebar.js`) when a dimension is a
   multi-select checkboxes filter, then sum across all matching combos (default
   `agFilterOptionsMethod: "sum"`).
3. Which filter dimensions are "relevant" to the current attribute is decided by
   `Scenario.getFilterGroupForAttribute(jsonName, attributeCode)` →
   `attribute.filterGroup` from the json file, split on `_`
   (`getFilterGroupArray()` in `vizmap.js`/`viztrends.js`). The sidebar filter
   widgets **not** named in that list are hidden for the current attribute
   (comment in `vizmap.js`: "filterGroup is to hide EVERY filter ... not show
   them" — i.e. everything configured in `templateSettings.filters` is a
   candidate, and `filterGroup` prunes down to what this one attribute needs).

## ⚠️ Attribute codes and filter codes are GLOBAL flat namespaces

`config/attributes.json` is keyed by `attributeCode` only (`Attribute` constructor
in `app/layouts/attribute.js` does `configAttributes[attributeCode]` — no
`jsonName` scoping). `config/filters.json` is keyed by `filterCode` only, same
deal. **If two different `j-*.json` files embed the same `attributeCode` or the
same `filterGroup` token, they share the exact same config entry** (alias,
definition, renderer/legend breakpoints, filter widget + options).

This came up for real: the new `j-zone-facility-metrics.json` export reuses
`aVMT`/`aVHT`/`aVHD` (already used by `j-zone-trip-metrics.json`'s "Zone Trip
Metrics (Road)" entity for a *different* measure — trip-end/PA-based VMT, not
facility-based VMT — harmless here since neither entity's `filterGroup`/renderer
needs differ enough to conflict, but worth checking case-by-case) and its
`filterGroup` used the token `fAreaType`, which already exists globally with
**string-valued** options (`"Rural"`, `"Transition"`, ...) used by the Road
Segments/Trends entity. The new export's raw `AREATYPE` data originally came
through as **numeric** codes (`1`–`5`) instead.

Two ways to resolve a token/value mismatch like this:
1. **Normalize the data to match the existing shared filter**, if the new
   export's raw values can be cleanly relabeled (e.g. numeric code → the same
   string label the existing filter already uses) and the mapping is unambiguous.
   This is what was actually done here: the facility-metrics json's `AREATYPE`
   segment (always a fixed position in every `data` key — verified first) was
   rewritten from `"1".."5"` to `"Rural".."CBD-like"` to match `fAreaType`
   exactly, so the new entity reuses the global `fAreaType` filter directly, no
   per-attribute override needed.
   - **This turned up a real correctness bug, not just a style mismatch**: the
     app's combo-key matching (`Scenario.getDataForFilterOptionsList`) normalizes
     a key by lowercasing, splitting on `_`, **sorting**, and rejoining — so key
     segment *order* doesn't matter. But `fFuncType`'s numeric codes (`1`–`42`)
     and the old numeric `AreaType` (`1`–`5`) overlap in the `1`–`5` range, so
     e.g. `FuncType=4, AreaType=1` and `FuncType=1, AreaType=4` both sort to the
     identical normalized key `"1_4"` — a silent aliasing collision that drops
     one of the two combos from every lookup. Relabeling AreaType to strings
     eliminated the shared value space and the collision. **Lesson: when two
     filter dimensions on the same entity can draw from overlapping value
     spaces, sort-based key matching can silently alias distinct combos onto
     each other — keep dimensions on an entity textually distinguishable (or
     verify positionally with a script, as above) rather than assuming "same
     combo count in a round-trip" means "same data".**
2. **Add a differently-named filter + per-attribute `filterOverride`**, when the
   new export's raw values *can't* be cleanly mapped onto the existing filter
   (e.g. a genuinely different option set, not just a different spelling).
   `config/attributes.json` entries support `filterOverride: [{ "filterOut":
   "<tokenInData>", "filterIn": "<actualFilterCodeToUse>" }]`.
   `getFilterGroupForAttributeCode()` (`vizmap.js`, also `vizmatrix.js`/
   `viztrends.js`) does a plain string `.replace()` of `filterOut` → `filterIn`
   on the attribute's raw `filterGroup` string *before* splitting/looking up
   sidebar filters — so you can point just the new entity's attributes at a new,
   separately-defined filter without touching the shared one. This is safe for
   attribute codes shared with other entities because `.replace()` is a no-op
   when the token isn't present in that other entity's own `filterGroup` string.

Before reusing an attribute code or filter-group token from a new TDM export,
check whether `config/attributes.json` / `config/filters.json` already define it
for a different entity, and whether the value representations actually match
(string vs numeric, same option set) — don't assume a shared name means
compatible data.

## Adding a new model entity (menu item) from a new scenario-data file

1. Inspect the new `j-*.json`: list `attributes[].attributeCode` /
   `.filterGroup`, and `filters[].filterCode` / `.fOptions` / `.filterLocation`.
   Node one-liners on the raw file are faster than trying to eyeball multi-MB
   JSON.
2. For each filter token in any `filterGroup`, check if it already exists in
   `config/filters.json`. If it's new, add it (`fWidget`: `"select"` for a
   single-value dimension like time-of-day/vehicle-type with one default + a
   `subTotals` entry marking which option is a pre-aggregated total; `"checkboxes"`
   for a multi-value dimension summed across selections — omit `fSelected` to
   default to "all checked"). If it already exists but the *values* don't match
   the new data's raw segment values, prefer relabeling the new export's raw
   segment values to match the existing filter's values (verify the segment
   position is fixed first, e.g. with a quick script over every `data` key) over
   minting a parallel filter — this also sidesteps the sort-collision risk
   described above when two dimensions share an overlapping value space. Only
   fall back to a differently-named filter + `filterOverride` (see above) when
   the value sets genuinely can't be mapped onto each other.
3. For each attribute code, check `config/attributes.json`. If new, add an entry
   with `alias`/`definition`/`rendererCollection` (copy an existing numeric
   attribute's structure — `main`/`compare_abs`/`compare_pct`/`main_divide_by`
   blocks — and retune `breakpoints` to the new data's actual magnitude; don't
   assume an existing attribute's breakpoints fit a differently-scaled measure
   even if the "same" code is reused). If reusing an existing code, add
   `filterOverride` as needed per above — don't change its alias/definition/
   breakpoints, since other entities depend on them.
4. Add a `submenuText` entry under the right `menuItems[].modelEntities` section
   in `config/app.json`, normally as a `views: [vizMap, vizTrends]` pair mirroring
   the nearest existing sibling entity (`baseGeoJsonKey`/`baseGeoJsonId` from
   `config/scenarios.json`'s `geojsons` map, `aggregators` from
   `config/aggregators.json`, `dividers` from `config/dividers.json`). List every
   filter code used by *any* attribute in `templateSettings.filters` — per-attribute
   pruning down to the relevant subset happens automatically via `filterGroup`.
5. Validate: `node -e "JSON.parse(require('fs').readFileSync('config/app.json'))"`
   etc. for every edited config file. There's no build step, so a JSON syntax
   error or a bad reference just breaks silently.
6. Sanity-check the combo-key resolution against the real data file (simulate
   `getDataForFilterOptionsList`'s normalize/cartesian-product logic in a quick
   Node script with the default filter selections) before trusting it'll render —
   catches typos in filter codes/values and reveals the per-zone value
   distribution so you can sanity-check (or retune) choropleth breakpoints.
