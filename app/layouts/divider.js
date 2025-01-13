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
  }
}