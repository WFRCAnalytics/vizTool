// Class for ScenarioTrend
class ScenarioTrend {
  constructor(data) {
    this.scnTrendCode = data.scnTrendCode;
    this.alias = data.alias || data.scnTrendCode; // Use data.alias if it exists, otherwise use data.scnTrendCode
    this.displayByDefault = data.displayByDefault;
    this.modelruns = data.modelruns;
  }
}