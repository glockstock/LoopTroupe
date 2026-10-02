/* Loop Troupe — park guide manifest (always loaded; keep it tiny).
   One entry per guide, keyed by park ID from js/data.js. The guide's content
   lives in `src` and is loaded lazily only on #/guide/<park-id>.
   `published` is the release switch: false keeps the guide off the park page
   and nav (it is still reachable by direct URL as a draft preview).
   scripts/check-guides.mjs refuses `published: true` while any claim is unverified.
   See docs/tech_spec.md, "Park guides". */
window.GUIDE_INDEX = {
  'cedar-point': { src: 'js/guides/cedar-point.js', published: false },
};
