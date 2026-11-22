// VMT/VHT/VHD (and the person-based aPMT/aPHT/aPHD) disclaimers - trip/facility/segment-based
// area summaries each have a real methodological gotcha (see config/disclaimers.json for the
// actual text). Basis is resolved off jsonName (the data source), not attributeCode - attribute
// codes are a global namespace (see CLAUDE.md) and the same code (e.g. aVMT) is reused by both a
// trip-based and a facility-based entity, so attributeCode alone can't tell the two apart.
function getVmtBasisForJsonName(jsonName) {
  if (!jsonName || !configDisclaimers) return null;
  return configDisclaimers.jsonNameBasis[jsonName] || null;
}

function getVmtDisclaimerText(basis) {
  return (basis && configDisclaimers?.basisText?.[basis]) || null;
}

function getVmtJumpTargets(basis) {
  return (basis && configDisclaimers?.basisJumpTargets?.[basis]) || [];
}

// Native title= tooltips (the asterisk's hover cue) can't hold markup or links - only plain
// text. The full paragraph, plus working in-app jump links, lives in the Definitions popup
// instead (vizsidebar.js's openDefinitionsPopup()), which already renders real HTML.
function vmtDisclaimerHoverText(basis) {
  const label = basis && configDisclaimers?.basisShortLabel?.[basis];
  if (!label) return null;
  return label + ' metric — see Definitions for the full methodology note.';
}

// Used by WijRadio's attribute options - a small asterisk marker with a native hover tooltip,
// or null if this basis has nothing to flag.
function renderVmtAsterisk(basis) {
  const hover = vmtDisclaimerHoverText(basis);
  if (!hover) return null;
  const span = document.createElement('span');
  span.className = 'vmt-disclaimer-asterisk';
  span.textContent = '*';
  span.title = hover;
  return span;
}

// In-app navigation to another model entity, reusing the same menuItems/MenuItem machinery
// url-state.js's own deep-link restore uses - no page reload, current scenario/filter state
// untouched. viewTemplate (e.g. 'vizTrends') optionally forces a specific view on a multi-view
// entity instead of landing on whichever view was last active for it.
function jumpToModelEntity(menuText, entityText, viewTemplate) {
  const menuItem = (typeof menuItems !== 'undefined' ? menuItems : []).find(m => m.menuText === menuText);
  if (!menuItem) return;

  if (viewTemplate) {
    const entity = menuItem.modelEntities.find(e => e.submenuText === entityText);
    const viewIndex = entity ? entity.views.findIndex(v => v.template === viewTemplate) : -1;
    if (viewIndex !== -1) {
      entity.activeViewIndex = viewIndex;
      preferredViewTemplate = viewTemplate;
    }
  }

  menuItem.loadMenuItemAndModelEntity(entityText);
}
