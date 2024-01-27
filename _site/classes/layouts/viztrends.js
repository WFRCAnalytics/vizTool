class VizTrends {
  constructor(data, modelEntity) {
    this.id = data.id || this.generateIdFromText(data.attributeTitle); // use provided id or generate one if not provided
    console.log('viztrends:construct:' + this.id);

    // link to parent
    this.modelEntity = modelEntity;

    this.jsonFileName = data.jsonFileName;
    this.sidebar = new VizSidebar(data.attributes,
                                  data.attributeSelected,
                                  data.attributeTitle,
                                  data.filters,
                                  data.aggregators,
                                  data.aggregatorSelected,
                                  data.aggregatorTitle,
                                  data.dividers,
                                  data.dividerSelected,
                                  data.dividerTitle,
                                  this)
  }
  
  generateIdFromText(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  renderSidebar() {
    this.sidebar.render();
  }

  afterUpdateSidebar() {
    console.log('viztrends:afterSidebarUpdate');
    this.updateDisplay();
  }
  
  afterUpdateAggregator() {
    console.log('viztrends:afterUpdateAggregator');
    //document.getElementById(this.comboSelector.id + '-container').innerHTML = '';
    //this.comboSelector.render();
    //this.renderSidebar();
    this.sidebar.render();
    this.afterUpdateSidebar();
  }

  afterFilterUpdate() {

  }

  getScenarioMain() {
    return this.getScenario(         document.getElementById('selectModMain' ).value,
                                     document.getElementById('selectGrpMain' ).value,
                            parseInt(document.getElementById('selectYearMain').value, 10)); // Assuming it's a number
  }

  getScenario(_modVersion, _scnGroup, _scnYear) {
    return dataScenarios.find(scenario =>
                              scenario.modVersion === _modVersion &&
                              scenario.scnGroup   === _scnGroup   &&
                              scenario.scnYear    === _scnYear
                              ) || null;
  }

  
  // get the attribute code that is selected
  getACode() {
    return this.sidebar.getACode();
  }

  // get the divider code that is selected
  getDCode() {
    return this.sidebar.getDCode();
  }

  getSelectedAggregator() {
    return this.sidebar.getSelectedAggregator();
  }
  

  getFilterGroup() {
    return this.getScenarioMain().getFilterGroupForAttribute(this.jsonFileName, this.getACode());
  }

  getFilterGroupArray() {
    var _filterGroup = this.getFilterGroup();
  
    if (_filterGroup) {
      // Split the _filterGroup by "_"
      return _filterGroup.split("_");
    }
  }

  getChartData(aCode, filterSelectionData) {
    if (aCode === 'aVmt') {
        return filterSelectionData.aVmt; // Change this to the appropriate property based on your data structure
    } else if (aCode === 'aVht') {
        return filterSelectionData.aVht; // Change this to the appropriate property based on your data structure
    } else if (aCode === 'aLMl') {
        return filterSelectionData.aLMl;
    } else {
        return 0; // return 0 if nothing is found
    }

    //This needs to include filter direction, tod, and vehicle type -- not just attribute. Do it here: (copy what bill did in vizmap L#272)

    // Handle other display names if needed
    return null;
  }

  getSegidOptions() {
    const segidOptions = [];
    const filter = this.getFilterGroup();

    const scenarioData = this.getScenarioMain().jsonData['roadway-trends'].data[filter];
    Object.keys(scenarioData).forEach(segId => {
        segidOptions.push(segId);
    });

    return segidOptions;
  }

  createLineChart(aCode, labels, chartData, aggIDsString) {
    console.log('viztrends:Creating the chart...');
    console.log("Selected radio button option under 'Display':", aCode);

    const containerElement = document.getElementById('trendContent');
    containerElement.innerHTML = '';
      
    
    const aggCode = this.getSelectedAggregator();
    const title = document.createElement('div');
    title.id = 'charttitle';
    title.innerHTML = '<h1>' + aggCode.agDisplayName + ' Trends</h1>'
    containerElement.appendChild(title);

    const chartContainer = document.createElement('div');
    chartContainer.id = 'chartContainer';
    containerElement.appendChild(chartContainer);

    const canvas = document.createElement('canvas');
    //canvas.width = 400;
    //canvas.height = 200;
    chartContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let currentChart = null;

    const aggIds = Object.keys(chartData);

    const createChart = () => {
      if (currentChart) {
          // Destroy existing Chart instance
          currentChart.destroy();
      }
      
      const scenarioGroups = [
        {"name": "RTP"},
        {"name": "NoBuild"},
        {"name": "Needs"},
        {"name": "Needs MAG"}
      ];

      currentChart = new Chart(ctx, {
        type: 'scatter', // Use scatter chart type
        data: {
          datasets: aggIds.flatMap(aggId => {
            // For each aggId, create a dataset for each scenario group
            return scenarioGroups.map(scenarioGroup => {
              const name = scenarioGroup.name;
              const values = chartData[aggId][name];
              const dataPoints = Object.keys(values).map(year => {
                return { 
                  x: parseInt(year, 10), // Ensure the year is a number
                  y: +values[year].toPrecision(4) // Round y values to 4 significant figures
                };
              });
      
              return {
                label: `${name}`,
                data: dataPoints,
                fill: false,
                borderColor: this.getRandomColor(),
                borderWidth: 3,
                pointRadius: 8,
                showLine: true // Draw lines between points
              };
            });
          })
        },
        options: {
          scales: {
            x: {
              type: 'linear',
              position: 'bottom',
              min: 2019, 
              ticks: {
                callback: function(value) {
                  // Convert value to string and remove commas
                  return value.toString().replace(/,/g, '');
                }
              }
            },
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
      
    // Initial chart creation
    createChart();
  }

  getRandomColor(index) {
    // Generate a random color based on index
    const colors = [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 99, 132, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
    ];

    return colors[index % colors.length];
  }

  updateDisplay() {
    const aCode = this.getACode();
    const dCode = this.getDCode();
    var comboCodes = this.sidebar.aggregatorFilter.getSelectedOptionsAsList();
    //const aggCode = this.getSelectedAggregator();
    //const segId = "0006_146.9"; // Change this to your desired SEGID
    //const segOptions = this.getSegidOptions();
  
    const scnGroupYearCombos = [
        { scnDisplay: 'RTP'      , scnGroup: 'Base'     , scnYear: 2019 },
        { scnDisplay: 'RTP'      , scnGroup: 'Base'     , scnYear: 2023 },
        { scnDisplay: 'RTP'      , scnGroup: 'TIP'      , scnYear: 2028 },
        { scnDisplay: 'RTP'      , scnGroup: 'RTP'      , scnYear: 2032 },
        { scnDisplay: 'RTP'      , scnGroup: 'RTP'      , scnYear: 2042 },
        { scnDisplay: 'RTP'      , scnGroup: 'RTP'      , scnYear: 2050 },
        { scnDisplay: 'NoBuild'  , scnGroup: 'Base'     , scnYear: 2019 },
        { scnDisplay: 'NoBuild'  , scnGroup: 'Base'     , scnYear: 2023 },
        { scnDisplay: 'NoBuild'  , scnGroup: 'TIP'      , scnYear: 2028 },
        { scnDisplay: 'NoBuild'  , scnGroup: 'NoBuild'  , scnYear: 2032 },
        { scnDisplay: 'NoBuild'  , scnGroup: 'NoBuild'  , scnYear: 2042 },
        { scnDisplay: 'NoBuild'  , scnGroup: 'NoBuild'  , scnYear: 2050 },
        { scnDisplay: 'Needs'    , scnGroup: 'Base'     , scnYear: 2019 },
        { scnDisplay: 'Needs'    , scnGroup: 'Base'     , scnYear: 2023 },
        { scnDisplay: 'Needs'    , scnGroup: 'TIP'      , scnYear: 2028 },
        { scnDisplay: 'Needs'    , scnGroup: 'Needs'    , scnYear: 2032 },
        { scnDisplay: 'Needs'    , scnGroup: 'Needs'    , scnYear: 2042 },
        { scnDisplay: 'Needs'    , scnGroup: 'Needs'    , scnYear: 2050 },
        { scnDisplay: 'Needs MAG', scnGroup: 'Base'     , scnYear: 2019 },
        { scnDisplay: 'Needs MAG', scnGroup: 'Base'     , scnYear: 2023 },
        { scnDisplay: 'Needs MAG', scnGroup: 'TIP'      , scnYear: 2028 },
        { scnDisplay: 'Needs MAG', scnGroup: 'Needs'    , scnYear: 2032 },
        { scnDisplay: 'Needs MAG', scnGroup: 'Needs'    , scnYear: 2042 },
        { scnDisplay: 'Needs MAG', scnGroup: 'Needs MAG', scnYear: 2050 }
    ];

    const labels = [2019,2023,2028,2032,2042,2050];
    const chartData = {};
    var filteredFeatures = {};

    function recastArrayIfNumeric(arr) {
      // Check if every item in the array is a numeric string
      const allNumeric = arr.every(item => !isNaN(item) && typeof item === 'string');
  
      // If all items are numeric strings, convert them to integers
      if (allNumeric) {
        return arr.map(item => parseInt(item, 10));
      } else {
        // Return the original array if not all items are numeric strings
        return arr;
      }
    }

    comboCodes = recastArrayIfNumeric(comboCodes);

    var aggIDs = comboCodes//[35,49];
    
    let aggIDsString = '';
    if (comboCodes.length > 1) {
        aggIDsString = comboCodes.join('_');
    } else if (comboCodes.length === 1) {
        aggIDsString = comboCodes[0].toString();
    }
    console.log('viztrends:Going to fetch the data now... agIDsString is ' + aggIDs);
    fetch("data/segmentsWithAggFields.geojson")
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter features where CO_FIPS is 35
        filteredFeatures = data.features.filter(feature => 
          aggIDs.includes(feature.properties[this.sidebar.aggregatorSelect.selected])
      );

        // Now you have an array of features where CO_FIPS is 35
        console.log(filteredFeatures);

        scnGroupYearCombos.forEach(combo => {
          const _scnDisplay = combo.scnDisplay;
          const _scnGroup = combo.scnGroup;
          const _scnYear = combo.scnYear;
          const _scenario = this.getScenario('v900', _scnGroup, _scnYear);
  
          if (_scenario) {
      
            if (!chartData[aggIDsString]) {
                chartData[aggIDsString] = {};
            }
            if (!chartData[aggIDsString][_scnDisplay]) {
                chartData[aggIDsString][_scnDisplay] = {};
            }
  
            chartData[aggIDsString][_scnDisplay][_scnYear] = 0;

            const filteredScenario = _scenario.getDataForFilterOptionsList(this.jsonFileName, this.sidebar.getListOfSelectedFilterOptions());
  
            filteredFeatures.forEach(feature => {
  
              const segId = feature.properties.SEGID;
              const filterSelectionData = filteredScenario[segId];
      
              if (filterSelectionData) {
                const selectedValue = this.getChartData(aCode, filterSelectionData);

                if (selectedValue == null | selectedValue == undefined) {
                  //chartData[aggIDsString][scnDisplay][scnYear] += 0;
                  console.log("null data found in here: " + aggIDsString + '_' + _scnDisplay + '_' + _scnYear)
                }

                if (selectedValue !== null & selectedValue !== undefined) {
                  chartData[aggIDsString][_scnDisplay][_scnYear] += selectedValue;
                }
              }
            })
          }
        });

      })
      .catch(error => {
        console.error('Error reading the JSON file:', error);
      });
    
    var filteredTazes = {};
    var filteredTazSeData = {};
    console.log('viztrends:Going to fetch the data now... agIDsString is ' + aggIDs);
    fetch("data/tazWithAggFields.geojson")
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter features where CO_FIPS is 35
        filteredTazes = data.features.filter(feature => 
          aggIDs.includes(feature.properties[this.sidebar.aggregatorSelect.selected])
      );

      var filteredTazList = [];
      // Loop through filteredTazes and extract TAZID values
      filteredTazes.forEach((taz) => {
        // Assuming TAZID is always present in the properties object
        if (taz.properties && taz.properties.TAZID) {
          // Check if TAZID is not already in the array
          if (!filteredTazList.includes(taz.properties.TAZID)) {
            filteredTazList.push(taz.properties.TAZID);
          }
        }
      });

      //read in the zonesSeData
      var sumAttribute = 0;
      scnGroupYearCombos.forEach(combo => {
        const scnDisplay = combo.scnDisplay;
        const scnGroup = combo.scnGroup;
        const scnYear = combo.scnYear;
        const scenarioData = this.getScenario('v900', scnGroup, scnYear);
        const filter = this.getFilterGroup();

        if (scenarioData) {

          const tazSeData = scenarioData.jsonData['zones-se-vizmap'].data[""];
          
          //filter the zonesSeData to only those zones that are within filteredTazList
          filteredTazSeData = Object.keys(tazSeData)
          .filter((key) => filteredTazList.includes(parseInt(key)))
          .reduce((result, key) => {
            result[key] = tazSeData[key];
            return result;
          }, {});

        }
        //sum up all the "selected divide by attribute"'s  value within the filtered zonesSeData list to get a sum total
        for (const key in filteredTazSeData) {
          if (filteredTazSeData[key][dCode] !== undefined) {
            sumAttribute += filteredTazSeData[key][dCode];
          }
        }
        console.log(sumAttribute);
      });
      
      //loop through the chartData and divide all the values by the sum just calculated
      for (const key1 in chartData) {
        for (const key2 in chartData[key1]) {
          for (const key3 in chartData[key1][key2]) {
            chartData[key1][key2][key3] /= sumAttribute;
          }
        }
      }
      
      this.createLineChart(aCode, labels, chartData, aggIDsString);

      })
      .catch(error => {
        console.error('Error reading the JSON file:', error);
      });

    }

}
