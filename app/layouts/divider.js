class Divider {
  constructor(dCode){
      
    this.dCode = dCode;

    console.log('divider:' + dCode)

    const _configDivider = configDividers[this.dCode];

    if (_configDivider === undefined) {
      return; // Exit the constructor if _configDivider is undefined
    }

    this.jsonName       = _configDivider.jsonName      ;
    this.baseGeoJsonKey = _configDivider.baseGeoJsonKey;
    this.baseGeoJsonId  = _configDivider.baseGeoJsonId ;
    this.attributeCode  = _configDivider.attributeCode ;
    this.alias          = _configDivider.alias         ;
    this.legendSuffix   = _configDivider.legendSuffix  ;
    this.filter         = _configDivider.filter        ;

    // divideResultBy scales the divide sum after it's computed (e.g. TRANSIT_RM's
    // Route-Direction-Miles -> Route-Miles, halved because each route's mileage is counted
    // once per direction). divideResultByUnlessFilterNarrowed names a filter (by fCode) that
    // scaling should only apply while it's at its full/default selection - e.g. halving
    // Route-Direction-Miles only yields true Route-Miles when every direction is included;
    // narrow that filter and the sum is no longer doubled, so scaling stops applying (see
    // VizTrends.updateAllChartData's _applyDividerScaling).
    this.divideResultBy = _configDivider.divideResultBy || null;
    this.divideResultByUnlessFilterNarrowed = _configDivider.divideResultByUnlessFilterNarrowed || null;
  }
}