var map;
var lyrQueryPts;

var proj3857   = new OpenLayers.Projection("EPSG:3857");
var proj900913 = new OpenLayers.Projection("EPSG:900913");
var proj4326   = new OpenLayers.Projection("EPSG:4326");
var mouseoverObs;
var hiliteCtl;
var popupObs;
var popupCtl;
var chartData = [];
var chartUrls = {};
var layerUrls = {};
var logsStore = new Ext.data.ArrayStore({
   fields    : ['type','name','url','t']
  ,listeners : {add : function(store,recs,idx) {
    pendingTransactions[recs[0].get('url')] = true;
  }}
});

var lastMapClick = {
   layer : ''
  ,xy    : ''
};

var pendingTransactions = {};
var viewsReady = 0;

var dNow;
setdNow(new Date());

var logsWin;
var legendImages = {};

var activeSettingsWindows = {};
var activeInfoWindows     = {};

function init() {
  var loadingMask = Ext.get('loading-mask');
  var loading = Ext.get('loading');

  //Hide loading message
  loading.fadeOut({duration : 0.2,remove : true});

  //Hide loading mask
  loadingMask.setOpacity(0.9);
  loadingMask.shift({
     xy       : loading.getXY()
    ,width    : loading.getWidth()
    ,height   : loading.getHeight()
    ,remove   : true
    ,duration : 1
    ,opacity  : 0.1
    ,easing   : 'bounceOut'
  });

  Ext.QuickTips.init();
  refreshTimer();

  var observationsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,checkOnly : true
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        getCaps(rec.get('url'),rec.get('name'),'observations');
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var observationsGridPanel = new Ext.grid.GridPanel({
     height      : 50
    ,id          : 'observationsGridPanel'
    ,store : new Ext.data.JsonStore({
       url       : 'query.php?type=obs&providers=coops,sura'
      ,fields    : ['name','url','properties']
      ,root      : 'data'
      ,listeners : {
        beforeload : function(sto) {
          sto.setBaseParam('eventtime',getEventtimeFromEventsComboBox());
          sto.setBaseParam('modelType',Ext.getCmp('modelTypesComboBox').getValue());
          Ext.getCmp('observationsGridPanel').getEl().mask('<table><tr><td>Loading...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>');
        }
        ,load      : function(sto) {
          Ext.getCmp('observationsGridPanel').getEl().unmask();
        }
      }
    })
    ,selModel    : observationsSelModel
    ,autoExpandColumn : 'name'
    ,columns     : [
       observationsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
      ,{id : 'info'                  ,renderer : renderLayerCalloutButton,width : 25}
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
      viewReady();
    }}
  });

  var modelsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,checkOnly : true
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        getCaps(rec.get('url'),rec.get('name'),'models');
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var modelsGridPanel = new Ext.grid.GridPanel({
     height      : 50
    ,id          : 'modelsGridPanel'
    ,store : new Ext.data.JsonStore({
       url       : 'query.php?type=models&providers=gomaine,sura'
      ,fields    : ['name','url','properties']
      ,root      : 'data'
      ,listeners : {
        beforeload : function(sto) {
          sto.setBaseParam('eventtime',getEventtimeFromEventsComboBox());
          sto.setBaseParam('modelType',Ext.getCmp('modelTypesComboBox').getValue());
          Ext.getCmp('modelsGridPanel').getEl().mask('<table><tr><td>Loading...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>');
        }
        ,load      : function(sto) {
          // Ext.getCmp('modelsGridPanel').getSelectionModel().selectAll();
          Ext.getCmp('modelsGridPanel').getEl().unmask();
        }
      }
    })
    ,selModel    : modelsSelModel
    ,autoExpandColumn : 'name'
    ,columns     : [
       modelsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
      ,{id : 'info'                  ,renderer : renderLayerCalloutButton,width : 25} 
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
      viewReady();
    }}
  });

  var gridsSelModel = new Ext.grid.CheckboxSelectionModel({
     header    : ''
    ,checkOnly : true
    ,listeners : {
      rowselect : function(sm,rowIndex,rec) {
        addGrid(rec.get('url'),rec.get('lyr'),rec.get('stl'),rec.get('sgl'),rec.get('name'),'grids');
      }
      ,rowdeselect : function(sm,rowIndex,rec) {
        map.getLayersByName(rec.get('name'))[0].setVisibility(false);
      }
    }
  });
  var gridsGridPanel = new Ext.grid.GridPanel({
     height      : 50
    ,id          : 'gridsGridPanel'
    ,store : new Ext.data.JsonStore({
       url       : 'query.php?type=grids&providers=eds'
      ,fields    : ['name','url','lyr','stl','sgl','leg','minT','maxT','varName','varUnits','customize','bbox','abstract']
      ,root      : 'data'
      ,listeners : {
        beforeload : function(sto) {
          sto.setBaseParam('eventtime',getEventtimeFromEventsComboBox());
          if (Ext.getCmp('gridsGridPanel').getEl()) {
            Ext.getCmp('gridsGridPanel').getEl().mask('<table><tr><td>Loading...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>');
          }
        }
        ,load      : function(sto) {
          if (Ext.getCmp('gridsGridPanel').getEl()) {
            Ext.getCmp('gridsGridPanel').getEl().unmask();
          }
          var d0 = new Date();
          sto.each(function(rec) {
            var d = new Date(rec.get('minT') * 1000);
            if (d < d0) {
               d0 = d;
            }
          });
          setdNow(d0);
          setMapTime();
        }
      }
    })
    ,selModel    : gridsSelModel
    ,autoExpandColumn : 'name'
    ,columns     : [
       gridsSelModel
      ,{id : 'name',dataIndex :'name',renderer : renderName}
      ,{id : 'info'                  ,renderer : renderLayerCalloutButton,width : 25}
    ]
    ,hideHeaders : true
    ,listeners   : {viewready : function() {
    }}
  });

  var legendsGridPanel = new Ext.grid.GridPanel({
     height      : 50
    ,id          : 'legendsGridPanel'
    ,store       : new Ext.data.ArrayStore({
       fields : ['name','displayName','status','timestamp','jsDate']
     })
    ,columns     : [
       {id : 'status',dataIndex : 'status',renderer : renderLayerStatus,width : 30}
      ,{id : 'legend',dataIndex : 'name'  ,renderer : renderLegend}
    ]
    ,autoExpandColumn : 'legend'
    ,hideHeaders      : true
    ,disableSelection : true
  });

  new Ext.Viewport({
     layout : 'border'
    ,items  : [
      {
         region      : 'west'
        ,width       : 275
        ,items       : [
          new Ext.FormPanel({
             title     : 'Catalog query filters'
            ,id        : 'queryFiltersPanel'
            ,border    : false
            ,bodyStyle : 'padding:5px 5px 0'
            ,labelWidth     : 90
            ,labelSeparator : ''
            ,items     : [
              {
                 border : false
                ,cls    : 'directionsPanel'
                ,html   : 'Select a model type, a storm or an event, and a parameter to begin your search.'
              }
              ,new Ext.form.ComboBox({
                store : new Ext.data.ArrayStore({
                   fields : ['id']
                  ,data   : [['Inundation']]
                })
                ,width          : 165
                ,id             : 'modelTypesComboBox'
                ,fieldLabel     : 'Model type'
                ,displayField   : 'id'
                ,valueField     : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'Inundation'
                ,listeners      : {
                  select : function(combo,rec) {
                    runQuery();
                  }
                }
              })
              ,new Ext.form.ComboBox({
                store : new Ext.data.ArrayStore({
                   fields : ['id','eventtime','year']
                  ,data   : [
                     ['Ike'             ,'2008-09-08T00:30:00Z/2008-09-16T00:00:00Z','2008']
                    ,['Current forecast','current'                                  ,''    ]
                  ]
                })
                ,width          : 165
                ,id             : 'eventsComboBox'
                ,fieldLabel     : 'Storm or event'
                ,displayField   : 'id'
                ,valueField     : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'Ike'
                ,listeners      : {
                  select : function(combo,rec) {
                    runQuery();
                  }
                }
              })
              ,new Ext.form.ComboBox({
                store : new Ext.data.ArrayStore({
                   fields : ['id']
                  ,data   : [['Water level']]
                })
                ,width          : 165
                ,id             : 'parametersComboBox'
                ,fieldLabel     : 'Parameter'
                ,displayField   : 'id'
                ,valueField     : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'Water level'
                ,listeners      : {
                  select : function(combo,rec) {
                    runQuery();
                  }
                }
              })
            ]
            ,tbar        : {items : [
              {
                 text    : 'View transaction logs'
                ,icon    : 'img/file_extension_log.png'
                ,tooltip : 'View transaction logs'
                ,handler : function() {
                  if (!logsWin || !logsWin.isVisible()) {
                    logsWin = new Ext.Window({
                       title  : 'Transaction logs'
                      ,layout : 'fit'
                      ,width  : 640
                      ,height : 480
                      ,constrainHeader : true
                      ,items  : new Ext.grid.GridPanel({
                         store        : logsStore
                        ,loadMask     : true
                        ,border       : false
                        ,enableHdMenu : false
                        ,disableSelection : true
                        ,columns      : [
                           {id : 'type',header : 'Type'              ,dataIndex : 'type'}
                          ,{id : 'name',header : 'Name'              ,dataIndex : 'name'}
                          ,{id : 'url' ,header : 'URL'               ,dataIndex : 'url' ,renderer : renderUrl}
                          ,{id : 't'   ,header : 'Elapsed time (sec)',dataIndex : 't'   ,align    : 'center'}
                        ]
                        ,autoExpandColumn : 'name'
                      })
                      ,tbar : [
                        {
                           text    : 'Clear transactions'
                          ,icon    : 'img/trash-icon.png'
                          ,tooltip : 'Clear transactions'
                          ,handler : function() {
                            logsStore.removeAll();
                            pendingTransactions = {};
                          }
                        }
                      ]
                    });
                    logsWin.show();
                  }
                }
              }
            ]}
          })
          ,{
             id        : 'queryResultsPanel'
            ,title     : 'Catalog query results'
            ,border    : false
            ,bodyStyle : 'padding:5px 5px 0'
            ,items     : [
              {
                 border : false
                ,cls    : 'directionsPanel'
                ,html   : 'Station data as well as gridded data may be mapped independently. When switching between station and grid tabs, be aware that your map and time series graph may be cleared.'
              }
              ,new Ext.TabPanel({
                 activeTab  : 0
                ,plain      : true
                ,resizeTabs : true
                ,tabWidth   : 135
                ,bodyStyle  : 'padding:5px 5px 0'
                ,id         : 'stationGridTabPanel'
                ,items      : [
                  {
                     title : 'Available stations'
                    ,id    : 'stationsTab'
                    ,items : [
                      {
                         border : false
                        ,cls    : 'directionsPanel'
                        ,html   : 'Select models and observations for time series comparisons.  Click here for more information on how this analysis is performed.'
                      }
                      ,new Ext.form.FieldSet({
                         title : '&nbsp;Model datasets&nbsp;'
                        ,items : modelsGridPanel
                      })
                      ,new Ext.form.FieldSet({
                         title : '&nbsp;Observation datasets&nbsp;'
                        ,items : observationsGridPanel
                      })
                    ]
                  }
                  ,{
                     title : 'Available grids'
                    ,id    : 'gridsTab'
                    ,items : [
                      {
                         border : false
                        ,cls    : 'directionsPanel'
                        ,html   : 'Select gridded datasets for mapping.  Click anywhere on the map to perform a time series extraction.'
                      }
                      ,new Ext.form.FieldSet({
                         title : '&nbsp;Gridded datasets&nbsp;'
                        ,items : gridsGridPanel
                      })
                      ,new Ext.form.FieldSet({
                         title : '&nbsp;Active legends&nbsp;'
                        ,items : legendsGridPanel
                      })
                    ]
                  }
                ]
                ,listeners : {tabchange : function(tabPanel,tab) {
                  if (tab.id == 'gridsTab') {
                    Ext.getCmp('mapTimeButtonGroup').enable();
                    Ext.getCmp('changeMapDateTimeButtonGroup').enable();
                    Ext.getCmp('requery').show();
                  }
                  else {
                    Ext.getCmp('mapTimeButtonGroup').disable();
                    Ext.getCmp('changeMapDateTimeButtonGroup').disable();
                    Ext.getCmp('requery').hide();
                  }
                  Ext.getCmp('mapPanel').doLayout();
                }}
              })
            ]
            ,tbar        : {items : [
              {
                 text    : 'Remove all mapped datasets'
                ,icon    : 'img/trash-icon.png'
                ,tooltip : 'Remove all mapped datasets'
                ,id      : 'removeDatasetsButton'
                ,handler : function() {
                  Ext.getCmp('modelsGridPanel').getSelectionModel().clearSelections();
                  Ext.getCmp('observationsGridPanel').getSelectionModel().clearSelections();
                  if (Ext.getCmp('gridsGridPanel').getEl()) {
                    Ext.getCmp('gridsGridPanel').getSelectionModel().clearSelections();
                  }
                  if (popupObs && popupObs.isVisible()) {
                    popupObs.hide();
                  }
                  var lyr = map.getLayersByName('hiliteMarkers')[0];
                  lyr.removeFeatures(lyr.features);
                  lyr.redraw();
                  lyrQueryPts.removeFeatures(lyrQueryPts.features);
                }
              }
            ]}
          }
        ]
        ,listeners        : {afterrender : function() {this.addListener('bodyresize',function(p,w,h) {
          var targetH = h - Ext.getCmp('queryResultsPanel').getPosition()[1] - 160; 
          targetH < 100 ? targetH = 100 : null;
          Ext.getCmp('stationsTab').setHeight(targetH);
          Ext.getCmp('gridsTab').setHeight(targetH);
          targetH -= 137;
          Ext.getCmp('observationsGridPanel').setHeight(targetH / 2);
          Ext.getCmp('modelsGridPanel').setHeight(targetH / 2);
          Ext.getCmp('gridsGridPanel').setHeight(targetH / 2);
          Ext.getCmp('legendsGridPanel').setHeight(targetH / 2);
        })}}
      }
      ,{
         region    : 'center'
        ,layout    : 'border'
        ,border    : false
        ,items     : [
          {
             split     : true
            ,region    : 'center'
            ,id        : 'mapPanel'
            ,html      : '<div id="map"></div>'
            ,bbar      : {items : [
              {
                 xtype     : 'buttongroup'
                ,id        : 'mapTimeButtonGroup'
                ,autoWidth : true
                ,columns   : 1
                ,title     : 'Map date & time'
                ,items     : [{
                   id    : 'mapTime'
                  ,text  : dNow.getUTCFullYear() + '-' + String.leftPad(dNow.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dNow.getUTCDate(),2,'0') + ' ' + String.leftPad(dNow.getUTCHours(),2,'0') + ':00 UTC'
                  ,width : 135
                }]
              }
              ,{
                 xtype     : 'buttongroup'
                ,id        : 'changeMapDateTimeButtonGroup'
                ,autoWidth : true
                ,columns   : 5
                ,title     : 'Change map date & time'
                ,items     : [
                   {
                     text    : 'Date'
                    ,tooltip : 'Change the map\'s date and time'
                    ,icon    : 'img/calendar_view_day16.png'
                    ,menu    : new Ext.menu.Menu({showSeparator : false,items : [
                      new Ext.DatePicker({
                         value     : new Date(dNow.getTime() + dNow.getTimezoneOffset() * 60000)
                        ,id        : 'datePicker'
                        ,listeners : {
                          select : function(picker,d) {
                            d.setUTCHours(0);
                            d.setUTCMinutes(0);
                            d.setUTCSeconds(0);
                            d.setUTCMilliseconds(0);
                            dNow = d;
                            setMapTime();
                          }
                        }
                      })
                    ]})
                  }
                  ,{
                     text    : '-6h'
                    ,icon    : 'img/ButtonRewind.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() - 6 * 3600000);setMapTime();}
                  }
                  ,{
                     text    : '-1h'
                    ,icon    : 'img/ButtonPlayBack.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() - 1 * 3600000);setMapTime();}
                  }
                  ,{
                     text    : '+1h'
                    ,icon    : 'img/ButtonPlay.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() + 1 * 3600000);setMapTime();}
                  }
                  ,{
                     text    : '+6h'
                    ,icon    : 'img/ButtonForward.png'
                    ,handler : function() {dNow = new Date(dNow.getTime() + 6 * 3600000);setMapTime();}
                  }
                ]
              }
              ,'->'
              ,{
                 xtype     : 'buttongroup'
                ,autoWidth : true
                ,columns   : 2
                ,title     : 'Map options'
                ,items     : [
                  {text : 'Bathymetry',icon : 'img/map16.png',menu : {items : [
                    {
                       text         : 'Hide bathymetry contours'
                      ,checked      : true
                      ,group        : 'bathy'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Bathymetry contours')[0];
                        if (!lyr) {
                          Ext.Msg.alert('Bathymetry contours',"We're sorry, but this layer is not available.");
                        }
                        else {
                          lyr.setVisibility(false);
                        }
                      }
                    }
                    ,{
                       text         : 'Show bathymetry contours'
                      ,checked      : false
                      ,group        : 'bathy'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Bathymetry contours')[0];
                        if (!lyr) {
                          Ext.Msg.alert('Bathymetry contours',"We're sorry, but this layer is not available.");
                        }
                        else {
                          lyr.setVisibility(true);
                        }
                      }
                    }
                  ]}}
                  ,{text : 'Basemap',icon : 'img/world16.png',menu : {items : [
                    {
                       text         : 'Show ESRI Ocean basemap'
                      ,checked      : true
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('ESRI Ocean')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                    ,{
                       text         : 'Show Google Hybrid basemap'
                      ,checked      : false
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Google Hybrid')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                    ,{
                       text         : 'Show Google Satellite basemap'
                      ,checked      : false
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Google Satellite')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                    ,{
                       text         : 'Show Google Terrain basemap'
                      ,checked      : false
                      ,group        : 'basemap'
                      ,handler      : function() {
                        var lyr = map.getLayersByName('Google Terrain')[0];
                        if (lyr.isBaseLayer) {
                          lyr.setOpacity(1);
                          map.setBaseLayer(lyr);
                          lyr.redraw();
                        }
                      }
                    }
                  ]}}
                ]
              }
            ]}
            ,listeners : {
              afterrender : function(p) {
                initMap();
              }
              ,bodyresize : function(p,w,h) {
                var el = document.getElementById('map');
                if (el) {
                  el.style.width  = w;
                  el.style.height = h;
                  map.updateSize();
                }
              }
            }
          }
          ,{
             split     : true
            ,id        : 'timeseriesPanel'
            ,title     : 'Time series analysis'
            ,height    : 250
            ,region    : 'south' 
            ,html      : '<div id="chart"></div>'
            ,tbar      : [
              {
                 text    : 'Clear graph'
                ,icon    : 'img/document_empty.png'
                ,tooltip : 'Clear current graph'
                ,handler : function() {
                  chartData = [];
                  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
                }
              }
              ,{
                 text    : 'Clear sites'
                ,icon    : 'img/draw_eraser.png'
                ,tooltip : 'Clear query sites and highlights'
                ,handler : function() {
                  var lyr = map.getLayersByName('hiliteMarkers')[0];
                  lyr.removeFeatures(lyr.features);
                  lyr.redraw();
                  lyrQueryPts.removeFeatures(lyrQueryPts.features);
                }
              }
              ,{
                 text    : 'Requery'
                ,icon    : 'img/arrow_refresh.png'
                ,tooltip : 'Rerun the query at the current query site'
                ,id      : 'requery'
                ,hidden  : true
                ,handler : function() {
                  if (lyrQueryPts.features.length > 0) {
                    mapClick(lastMapClick['xy'],true,true);
                  }
                }
              }
              ,'->'
              ,'Legend position :'
              ,' '
              ,new Ext.form.ComboBox({
                 store          : new Ext.data.ArrayStore({
                   fields : ['id']
                  ,data   : [
                     ['NE']
                    ,['NW']
                    ,['SE']
                    ,['SW'] 
                    ,['Off']
                  ]
                })
                ,id             : 'legendPositionComboBox'
                ,valueField     : 'id'
                ,displayField   : 'id'
                ,mode           : 'local'
                ,forceSelection : true
                ,triggerAction  : 'all'
                ,editable       : false
                ,value          : 'NE'
                ,width          : 50
                ,listeners      : {select : function(comboBox,rec) {
                  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
                }}
              })
            ]
            ,listeners : {
              afterrender : function(win) {
                win.addListener('resize',function(win) {
                  var el = document.getElementById('chart');
                  el.style.width  = win.getWidth() - 15;
                  el.style.height = win.getHeight() - 85;
                  if (!chartData || chartData.length <= 0) {
                    el.innerHTML = '<table width="100%" class="directionsPanel"><tr><td style="padding:10px 40px 0px 40px">Begin by selecting values for the catalog query filters.  Then select observation and model datasets to analyze.  Once you see dots on the map, click one, and then click on the parmater link in the popup window.  A time series graph will appear here.</td></tr></table>';
                  }
                  else {
                    var prevPt;
                    $('#chart').bind('plothover',function(event,pos,item) {
                      if (item) {
                        var x = new Date(item.datapoint[0] + new Date().getTimezoneOffset() * 60 * 1000);
                        var y = item.datapoint[1];
                        if (prevPoint != item.dataIndex) {
                          $('#tooltip').remove();
                          showToolTip(item.pageX,item.pageY,item.series.label + '<br/>' + y + ' @ ' + shortMonthDayStringWithTime(x));
                        }
                        prevPoint = item.dataIndex;
                      }
                      else {
                        $('#tooltip').remove();
                        prevPoint = null;
                      }
                    });

                    $.plot(
                     $('#chart')
                      ,chartData
                      ,{
                         xaxis  : {mode : 'time'}
                        ,pan    : {interactive : true}
                        ,grid   : {backgroundColor : {colors : ['#fff','#eee']},borderWidth : 1,borderColor : '#99BBE8',hoverable : true}
                        ,legend : {
                           show           : Ext.getCmp('legendPositionComboBox').getValue() != 'Off'
                          ,position       : Ext.getCmp('legendPositionComboBox').getValue().toLowerCase(),backgroundOpacity : 0.3
                          ,labelFormatter : function(label,series) {
                            var lbl = [label];
                            if (!new RegExp(/^grid\./).test(label)) {
                              lbl.push('<a href="javascript:hilitePoint(' + series.lon + ',' + series.lat + ',\'' + series.color + '\')"><img style="margin-bottom:-3px" title="Hilight this site" src="img/flashlight_shine.png"></a>');
                              lbl.push('<a href="javascript:setCenterOnPoint(' + series.lon + ',' + series.lat + ')"><img style="margin-bottom:-3px" title="Zoom & recenter map to this site" src="img/zoom.png"></a>');
                            }
                            lbl.push('<a href="javascript:removeChartLayer(\'' + series.id + '\')"><img style="margin-bottom:-3px" title="Remove from graph" src="img/delete-round.png"></a>');
                            return lbl.join(' ');
                          }
                        }
                      }
                    );
                  }
                });
              }
            }
          }
        ]
      }
    ]
  });
}

function initMap() {
  OpenLayers.Projection.addTransform("EPSG:4326","EPSG:3857",OpenLayers.Layer.SphericalMercator.projectForward);
  OpenLayers.Projection.addTransform("EPSG:3857","EPSG:4326",OpenLayers.Layer.SphericalMercator.projectInverse);

  OpenLayers.Util.onImageLoadError = function() {this.src = 'img/blank.png';}

  // patch openlayers 2.11RC to fix problem when switching to a google layer
  // from a non google layer after resizing the map
  // http://osgeo-org.1803224.n2.nabble.com/trunk-google-v3-problem-resizing-and-switching-layers-amp-fix-td6578816.html
  OpenLayers.Layer.Google.v3.onMapResize = function() {
    var cache = OpenLayers.Layer.Google.cache[this.map.id];
    cache.resized = true;
  };
  OpenLayers.Layer.Google.v3.setGMapVisibility_old =
  OpenLayers.Layer.Google.v3.setGMapVisibility;
  OpenLayers.Layer.Google.v3.setGMapVisibility = function(visible) {
    var cache = OpenLayers.Layer.Google.cache[this.map.id];
    if (visible && cache && cache.resized) {
      google.maps.event.trigger(this.mapObject,'resize');
      delete cache.resized;
    }
    OpenLayers.Layer.Google.v3.setGMapVisibility_old.apply(this,arguments);
  };

  lyrQueryPts = new OpenLayers.Layer.Vector(
     'Query points'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
         externalGraphic : 'img/${img}'
        ,pointRadius     : 10
        ,graphicOpacity  : 1
        ,graphicWidth    : 16
        ,graphicHeight   : 16
      }))
    })}
  );

  map = new OpenLayers.Map('map',{
    layers            : [
      new OpenLayers.Layer.XYZ(
        'ESRI Ocean'
        ,'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/${z}/${y}/${x}.jpg'
        ,{
           sphericalMercator : true
          ,isBaseLayer       : true
          ,wrapDateLine      : true
        }
      )
      ,new OpenLayers.Layer.Google('Google Hybrid',{
         type          : google.maps.MapTypeId.HYBRID
        ,projection    : proj900913
        ,opacity       : 1
        ,visibility    : false
        ,minZoomLevel  : 2
      })
      ,new OpenLayers.Layer.Google('Google Satellite',{
         type          : google.maps.MapTypeId.SATELLITE
        ,projection    : proj900913
        ,opacity       : 1
        ,visibility    : false
        ,minZoomLevel  : 2
      })
      ,new OpenLayers.Layer.Google('Google Terrain',{
         type          : google.maps.MapTypeId.TERRAIN
        ,projection    : proj900913
        ,opacity       : 1
        ,visibility    : false
        ,minZoomLevel  : 2
      })
      ,lyrQueryPts
    ]
    ,projection        : proj900913
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
  });

  map.addControl(new OpenLayers.Control.Graticule({
    labelSymbolizer : {
       fontColor   : "#666"
      ,fontSize    : "10px"
      ,fontFamily  : "tahoma,helvetica,sans-serif"
    }
    ,lineSymbolizer  : {
       strokeWidth     : 0.40
      ,strokeOpacity   : 0.75
      ,strokeColor     : "#999999"
      ,strokeDashstyle : "dash"
    }
  }));

  map.addLayer(new OpenLayers.Layer.Vector(
     'hiliteMarkers'
    ,{
      styleMap : new OpenLayers.StyleMap({
        'default' : new OpenLayers.Style(
          {
             pointRadius     : 20
            ,fillColor       : "${fillColor}"
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#0000ff'
            ,strokeOpacity   : 1
          }
        )
      })
    }
  ));

  addTileCache({
     name       : 'Bathymetry contours'
    ,url        : 'http://assets.maracoos.org/tilecache/'
    ,layer      : 'bathy'
    ,projection : proj900913
    ,visibility : false
  });


  map.setCenter(new OpenLayers.LonLat(-10536302.833765,3885808.4963698),4);

  map.events.register('click',this,function(e) {
    mapClick(e.xy);
  });

  map.events.register('addlayer',this,function() {
    map.setLayerIndex(lyrQueryPts,map.layers.length - 1);
  });

  map.events.register('moveend',this,function() {
    if (popupObs && !popupObs.isDestroyed) {
      popupObs.show();
    }
  });
}

function renderName(val,metadata,rec) {
  var lab = val.split('.');
  lab.shift();
  metadata.attr = 'ext:qtip="' + lab.join('.') + '"';
  return lab.join('.');
}

function renderLayerCalloutButton(val,metadata,rec) {
  var img = 'img/page_go.png';
  if (!new RegExp(/^grid\./).test(rec.get('name'))) {
    img = 'img/page_go_disabled.png';
    return '<img title="Layer details and customization not available for this data type" style="margin-top:-2px" src="' + img + '">';
  }
  else {
    return '<a id="info.' + rec.get('name') + '" href="javascript:goLayerCallout(\'' + rec.get('name')  + '\')"><img title="Layer details and customization" style="margin-top:-2px" src="' + img + '"></a>';
  }
}


function renderUrl(val,metadata,rec) {
  return '<a target=_blank href="' + val + '">' + val + '</a>';
}

function renderLayerStatus(val,metadata,rec) {
  if (val == 'loading') {
    return '<img src="img/loading.gif">';
  }
  else {
    return '<img class="layerIcon" src="img/DEFAULT.drawn.png">';
  }
}

function renderLegend(val,metadata,rec) {
  metadata.attr = 'ext:qtip="' + val.split('.').slice(1) + '"';
  var a = [val.split('.').slice(1)];
  if (rec.get('timestamp') && rec.get('timestamp') != '') {
    a.push(rec.get('timestamp'));
  }
  var gridsSto = Ext.getCmp('gridsGridPanel').getStore();
  var gridsRec = gridsSto.getAt(gridsSto.find('name',val));
  if (!legendImages[val]) {
    var img = new Image();
    img.src = gridsRec.get('leg');
    legendImages[val] = img;
  }
  a.push('<img src="' + gridsRec.get('leg') + '">');
  return a.join('<br/>');
}

function getCaps(url,name,type) {

  function getCapsCallback(l,url,type,r) {
    delete pendingTransactions[url];
    var sos = new SOSCapabilities(new OpenLayers.Format.XML().read(r.responseText));
    if (sos.type === 'EXCEPTION') {
      l.events.triggerEvent('loadend');
      Ext.Msg.alert('SOS exception',sos.exception_error);
      return;
    }

    var rec = Ext.getCmp(type + 'GridPanel').getStore().getAt(Ext.getCmp(type + 'GridPanel').getStore().find('name',name));
    var targetProperties = rec.get('properties')[Ext.getCmp('parametersComboBox').getValue()];

    for (var i = 0; i < sos.offerings.length; i++) {
      var properties = getProperties({offering : sos.offerings[i]});
      var plot = false;
      var tp = {};
      for (var p in properties) {
        if (targetProperties) {
          plot = plot || targetProperties.prop == p;
          if (targetProperties.prop == p) {
            tp = {
               prop        : p
              ,getObsExtra : targetProperties.getObsExtra
            };
          }
        }
      }
      if (plot) {
        var f = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(sos.offerings[i].llon,sos.offerings[i].llat).transform(proj4326,map.getProjectionObject()));
        f.attributes = {
           type             : 'getCaps'
          ,offering         : sos.offerings[i]
          ,dataset          : name
          ,targetProperties : tp
        };
        l.addFeatures(f);
      }
    }

    l.events.triggerEvent('loadend');
  }

  var l = map.getLayersByName(name)[0];
  if (!l) {
    var l = new OpenLayers.Layer.Vector(
       name
      ,{
        styleMap : new OpenLayers.StyleMap({
          'default' : new OpenLayers.Style(
            {
               pointRadius     : "${pointRadius}"
              ,fillColor       : "${fillColor}"
              ,fillOpacity     : 0.7
              ,strokeWidth     : 1
              ,strokeColor     : "${strokeColor}"
              ,strokeOpacity   : 1
            }
            ,{
              context          : {
                fillColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#ffcdff' : '#e8bb99';
                }
                ,strokeColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#bc00bc' : '#b56529';
                }
                ,pointRadius : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? 4 : 6;
                }
              }
            } 
          )
          ,'temporary' : new OpenLayers.Style(
            {
               pointRadius     : "${pointRadius}"
              ,fillColor       : "${fillColor}"
              ,fillOpacity     : 0.7
              ,strokeWidth     : 1
              ,strokeColor     : "${strokeColor}"
              ,strokeOpacity   : 1
            }
            ,{
              context          : {
                fillColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#ff7c5d' : '#99BBE8';
                }
                ,strokeColor : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? '#ff0000' : '#1558BB';
                }
                ,pointRadius : function(f) {
                  return (f.layer.name.indexOf('model.') >= 0) ? 4 : 6;
                }
              }
            }
          )
          ,'select' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
             pointRadius     : 6
            ,fillColor       : '#99e9ae'
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#1d8538'
            ,strokeOpacity   : 1
          }))
        })
      }
    );
    l.events.register('loadstart',this,function(e) {
      mapLoadstartMask(l.name);
    });
    l.events.register('loadend',this,function(e) {
      mapLoadendUnmask(l.name);
    });
    l.events.register('visibilitychanged',this,function(e) {
      mapLoadendUnmask(l.name);
    });
    map.addLayer(l);
    addToHiliteCtl(l);
    addToPopupCtl(l);

    logsStore.insert(0,new logsStore.recordType({
       type : 'GetCaps'
      ,name : name
      ,url  : url
      ,t    : 0
    }));

    l.events.triggerEvent('loadstart');
    OpenLayers.Request.issue({
       url      : 'get.php?u=' + encodeURIComponent(url)
      ,callback : OpenLayers.Function.bind(getCapsCallback,null,l,url,type)
    });
  }
  else {
    l.setVisibility(true);
  }
}

function getObsCallback(property,name,url,lon,lat,r) {
  delete pendingTransactions[url];
  var sos = new SOSObservation(new OpenLayers.Format.XML().read(r.responseText));
  if (sos.type === 'EXCEPTION') {
    graphLoadendUnmask(url);
    Ext.Msg.alert('SOS exception',sos.exception_error);
    return;
  }

  var definitionToFieldNameAndUOM = {};
  var fieldNameToUOM              = {};
  for (var i = 0; i < sos.fields.length; i++) {
    definitionToFieldNameAndUOM[sos.fields[i].definition] = {
       fieldName : sos.fields[i].name
      ,uom       : sos.fields[i].uom
    };
    fieldNameToUOM[sos.fields[i].name] = {
      uom        : sos.fields[i].uom
    };
  }

  var d = [];
  for (var i = 0; i < sos.observations.length; i++) {
    var t;
    if (sos.observations[i].Time) {
      t = isoDateToDate(sos.observations[i].Time);
    }
    else if (sos.observations[i].time) {
      t = isoDateToDate(sos.observations[i].time);
    }
    if (t) {
      var val;
      if (typeof definitionToFieldNameAndUOM[property] == 'object') {
        val = sos.observations[i][definitionToFieldNameAndUOM[property].fieldName];
      }
      else {
        val = sos.observations[i][property];
      }
      d.push([t.getTime(),val]);
    }
  }

  if (d.length > 0) {
    var uom = '';
    if (typeof definitionToFieldNameAndUOM[property] == 'object') {
      uom = ' (' + definitionToFieldNameAndUOM[property].uom + ')';
    }
    else {
      uom = ' (' + fieldNameToUOM[property].uom + ')';
    }
    chartData.push({
       data  : d
      ,label : property + ' ' + name + uom
      ,lines : {show : true}
      ,lon   : lon
      ,lat   : lat
      ,id    : Ext.id()
    });
  }
  Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));

  graphLoadendUnmask(url);
}

function getObs(layerName,url,property,name,lon,lat,drill,getObsExtra) {
  url += getObsExtra;

  graphLoadstartMask(url);

  logsStore.insert(0,new logsStore.recordType({
     type : 'GetObs'
    ,name : name
    ,url  : url
    ,t    : 0
  }));

  OpenLayers.Request.issue({
     url      : 'get.php?u=' + encodeURIComponent(url)
    ,callback : OpenLayers.Function.bind(getObsCallback,null,property,name,url,lon,lat)
  });

  if (drill) {
    var p0 = new OpenLayers.Geometry.Point(lon,lat).transform(proj4326,map.getProjectionObject());
    for (var i = 0; i < map.layers.length; i++) {
      if (new RegExp(/^(obs|model)\./).test(map.layers[i].name) && map.layers[i].name != layerName && map.layers[i].visibility) {
        var d = null;
        var f = null;
        for (var j = 0; j < map.layers[i].features.length; j++) {
          if (typeof d != 'number' || p0.distanceTo(map.layers[i].features[j].geometry) < d) {
            d = p0.distanceTo(map.layers[i].features[j].geometry);
            f = map.layers[i].features[j];
          }
        }
        if (typeof d == 'number') {
          var properties  = getProperties(f.attributes);
          var getObsFired = false;
          var props       = [];
          for (var p in properties) {
            props.push(p);
            if (p == property || (f.attributes.targetProperties && f.attributes.targetProperties.prop == p)) {
              getObsFired = true;
              getObs(
                 f.layer.name
                ,properties[p]
                ,p
                ,f.attributes.offering.shortName + ' ' + f.attributes.dataset
                ,f.attributes.offering.llon
                ,f.attributes.offering.llat
                ,false
                ,getObsExtra
              );
            }
          }
          if (!getObsFired) {
            props.sort();
            var data = [];
            for (var j = 0; j < props.length; j++) {
              var shortP = props[j].split('/');
              shortP = shortP[shortP.length-1];
              shortP = shortP.substr(0,40) + (shortP.length > 40 ? '...' : '');
              data.push([
                 shortP
                ,props[j]
                ,f.layer.name
                ,properties[props[j]]
                ,f.attributes.offering.shortName
                ,f.attributes.dataset
                ,f.attributes.offering.llon
                ,f.attributes.offering.llat
                ,getObsExtra
              ]);
            }
            new Ext.Window({
               title  : 'Select a variable for comparison'
              ,modal  : true
              ,layout : 'fit'
              ,width  : 275
              ,height : 250
              ,items  : [new Ext.FormPanel({
                 labelWidth : 1
                ,bodyStyle  : 'padding : 5;border-top : 0px;border-left : 0px;border-right : 0px'
                ,items      : [
                   {html : 'We are unable to determine which variable name to use for anlaysis from dataset "' + f.attributes.offering.shortName + ' ' + f.attributes.dataset + '".  Please select from the list below.',border : false}
                  ,{html : '<img src="img/blank.png" height=8>',border : false}
                  ,new Ext.form.FieldSet({title : '&nbsp;Available variables&nbsp;',items : new Ext.form.ComboBox({
                     store          : new Ext.data.ArrayStore({
                       fields : ['short','id','layerName','url','shortName','dataset','llon','llat','getObsExtra']
                      ,data   : data
                    })
                    ,displayField   : 'short'
                    ,valueField     : 'id'
                    ,mode           : 'local'
                    ,forceSelection : true
                    ,triggerAction  : 'all'
                    ,editable       : false
                    ,width          : 210
                  })})
                ]
                ,buttons : [
                  {text : 'Query' ,handler : function() {
                    var combo = this.findParentByType('window').findByType('combo')[0];
                    var sto   = combo.getStore();
                    var idx   = sto.find('id',combo.getValue());
                    if (idx >= 0) {
                      var rec = sto.getAt(idx);
                      getObs(
                         rec.get('layerName')
                        ,rec.get('url')
                        ,rec.get('id')
                        ,rec.get('shortName') + ' ' + rec.get('dataset')
                        ,rec.get('llon')
                        ,rec.get('llat')
                        ,false
                        ,rec.get('getObsExtra')
                      );
                      this.findParentByType('window').close();
                    }
                  }}
                  ,{text : 'Cancel',handler : function() {this.findParentByType('window').close();}}
                ]
              })]
            }).show();
          }
        }
      }
    }
  }
}

function getProperties(attr) {
  var p = {};
  if (!attr.offering) {
    return false;
  }
  attr.offering.properties.sort();
  for (var i = 0; i < attr.offering.properties.length; i++) {
    p[attr.offering.properties[i]] = attr.offering.getObsUrl(attr.offering.properties[i]) + '&eventtime=' + getEventtimeFromEventsComboBox();
  }
  return p;
}

function isoDateToDate(s) {
  // 2010-01-01T00:00:00Z
  s = s.replace("\n",'');
  var p = s.split('T');
  if (p.length == 2) {
    var ymd = p[0].split('-');
    var hm = p[1].split(':');
    return new Date(
       ymd[0]
      ,ymd[1] - 1
      ,ymd[2]
      ,hm[0]
      ,hm[1]
    );
  }
  else {
    return false;
  }
}

function shortDateStringNoTime(d) {
  if (!d) {
    return ' ';
  }
  return (d.getUTCMonth() + 1)
    + '/' + d.getUTCDate()
    + '/' + d.getUTCFullYear();
}

function shortMonthDayStringWithTime(d) {
  if (!d) {
    return ' ';
  }
  return zeroPad((d.getUTCMonth() + 1) * 1,2)
    + '/'
    + zeroPad(d.getUTCDate(),2)
    + ' '
    + zeroPad(d.getUTCHours(),2)
    + ':'
    + zeroPad(d.getUTCMinutes(),2)
    + ' UTC';
}

function shortDateToDate(s) {
  // 10/22/2011 08:00 UTC-04
  var p = s.split(' ');
  var mdy = p[0].split('/');
  var hm = p[1].split(':');
  return new Date(
     mdy[2]
    ,mdy[0] - 1
    ,mdy[1]
    ,hm[0]
    ,hm[1]
  );
}

function refreshTimer() {
  var hits = 0;
  for (i in pendingTransactions) {
    var idx = logsStore.find('url',i);
    if (idx >= 0) {
      var rec = logsStore.getAt(idx);
      rec.set('t',rec.get('t') + 1);
      rec.commit();
      hits++;
    }
  }
  setTimeout('refreshTimer()', 1000);
}

function hilitePoint(lon,lat,color) {
  if (!lon || !lat) {
    return;
  }
  var f = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lon,lat).transform(proj4326,map.getProjectionObject()));
  f.attributes = {
    fillColor : color
  }
  var lyr = map.getLayersByName('hiliteMarkers')[0];
  lyr.addFeatures(f);
  lyr.redraw();
}

function setCenterOnPoint(lon,lat) {
  if (!lon || !lat) {
    return;
  }
  map.setCenter(new OpenLayers.LonLat(lon,lat).transform(proj4326,map.getProjectionObject()),map.getZoom() > 9 ? map.getZoom() : 9);
}

function removeChartLayer(id) {
  var idx;
  for (var i = 0; i < chartData.length; i++) {
    if (chartData[i].id == id) {
      idx = i;
    }
  }
  if (idx >= 0) {
    chartData.splice(0,1);
    Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
  }
}

function getEventtimeFromEventsComboBox() {
  var rec = Ext.getCmp('eventsComboBox').getStore().getAt(Ext.getCmp('eventsComboBox').getStore().find('id',Ext.getCmp('eventsComboBox').getValue()));
  var eventtime = rec.get('eventtime');
  if (eventtime == 'current') {
    var dNow = new Date();
    dNow.setUTCHours(0);
    dNow.setUTCMinutes(0);
    dNow.setUTCSeconds(0);
    dNow.setUTCMilliseconds(0);
    var dMin = new Date(dNow.getTime() - 12 * 60 * 60 * 1000);
    var dMax = new Date(dNow.getTime() + 24 * 60 * 60 * 1000);
    eventtime = dMin.getUTCFullYear() + '-' + String.leftPad(dMin.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dMin.getUTCDate(),2,'0') + 'T' + String.leftPad(dMin.getUTCHours(),2,'0') + ':00:00Z'
      + '/'
      + dMax.getUTCFullYear() + '-' + String.leftPad(dMax.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dMax.getUTCDate(),2,'0') + 'T' + String.leftPad(dMax.getUTCHours(),2,'0') + ':00:00Z';
  }
  return eventtime;
}

function runQuery() {
  var selMod = Ext.getCmp('modelsGridPanel').getSelectionModel();
  var selObs = Ext.getCmp('observationsGridPanel').getSelectionModel();
  var selGrd = Ext.getCmp('gridsGridPanel').getSelectionModel();

  if (selMod.getSelections().length + selObs.getSelections().length + selGrd.getSelections().length > 0) {
    Ext.MessageBox.confirm('Comfirm map reset','You have changed your filter options; the map must be reset.  Are you sure you wish to continue?',function(but) {
      if (but == 'yes') {
        selMod.clearSelections();
        selObs.clearSelections(); 
        selGrd.clearSelections();
        Ext.getCmp('modelsGridPanel').getStore().load();
        Ext.getCmp('observationsGridPanel').getStore().load();
        Ext.getCmp('gridsGridPanel').getStore().load();
        if (popupObs && !popupObs.isDestroyed) {
          popupObs.hide();
        }
      }
    });
  }
  else {
    Ext.getCmp('modelsGridPanel').getStore().load();
    Ext.getCmp('observationsGridPanel').getStore().load();
    Ext.getCmp('gridsGridPanel').getStore().load();
    var rec = Ext.getCmp('eventsComboBox').getStore().getAt(Ext.getCmp('eventsComboBox').getStore().find('id',Ext.getCmp('eventsComboBox').getValue()));
    addStormTrack(rec.get('id'),rec.get('eventtime'),rec.get('year'));
  }
}

function viewReady() {
  viewsReady++;
  if (viewsReady == 2) {
    runQuery();
  }
}

function graphLoadstartMask(url) {
  chartUrls[url] = true;
  Ext.getCmp('timeseriesPanel').getEl().mask('<table><tr><td>Updating graph...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>','mask');
}

function graphLoadendUnmask(url) {
  delete chartUrls[url];
  var hits = 0;
  for (var i in chartUrls) {
    hits++;
  }
  if (hits == 0) {
    Ext.getCmp('timeseriesPanel').getEl().unmask();
  }
}

function mapLoadstartMask(url) {
  layerUrls[url] = true;
  Ext.getCmp('mapPanel').getEl().mask('<table><tr><td>Updating map...&nbsp;</td><td><img src="js/ext-3.3.0/resources/images/default/grid/loading.gif"></td></tr></table>','mask');
}

function mapLoadendUnmask(url) {
  delete layerUrls[url];
  var hits = 0;
  for (var i in layerUrls) {
    hits++;
  }
  if (hits == 0) {
    Ext.getCmp('mapPanel').getEl().unmask();
  }
}

function showToolTip(x,y,contents) {
  $('<div id="tooltip">' + contents + '</div>').css({
     position           : 'absolute'
    ,display            : 'none'
    ,top                : y + 10
    ,left               : x + 10
    ,border             : '1px solid #99BBE8'
    ,padding            : '2px'
    ,'background-color' : '#fff'
    ,opacity            : 0.80
    ,'z-index'          : 10000001
  }).appendTo("body").fadeIn(200);
}

function zeroPad(number,length) {
   number = String(number);
   var zeros = [];
   for (var i = 0 ; i < length ; ++i) {
     zeros.push('0');
   }
   return zeros.join('').substring(0, length - number.length) + number;
}

function addStormTrack(storm,eventtime,year) {
  if (map.getLayersByName('Storm track')[0]) {
    var l = map.getLayersByName('Storm track')[0];
    map.removeLayer(l);
  }

  var l = new OpenLayers.Layer.Vector('Storm track',{
    styleMap   : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        {
           pointRadius   : 2
          ,fillColor     : '#333333'
          ,fillOpacity   : 0.20
          ,strokeColor   : '#333333'
          ,strokeOpacity : 0.20
        }
      )
      ,'temporary' : new OpenLayers.Style(
        {
           pointRadius     : "${pointRadius}"
          ,fillColor       : '#333333'
          ,fillOpacity     : "${fillOpacity}"
          ,strokeColor     : '#333333'
          ,strokeOpacity   : "${strokeOpacity}"
        }
        ,{
          context          : {
            pointRadius : function(f) {
              return f.attributes.t ? 5 : 2;
            }
            ,strokeOpacity : function(f) {
              return f.attributes.t ? 0.75 : 0.20;
            }
            ,fillOpacity : function(f) {
              return f.attributes.t ? 0.40 : 0.20;
            }
          }
        }
      )
      ,'select' : new OpenLayers.Style(
        {
           pointRadius   : 2
          ,fillColor     : '#333333'
          ,fillOpacity   : 0.20
          ,strokeColor   : '#333333'
          ,strokeOpacity : 0.20
        }
      )
    })
  });
  map.addLayer(l);
  addToHiliteCtl(l);
  addToPopupCtl(l);

  OpenLayers.Request.issue({
     url      : 'getStormGeoJSON.php?storm=' + storm + '&eventtime=' + eventtime + '&year=' + year
    ,callback : function(r) {
      var json = new OpenLayers.Format.JSON().read(r.responseText);
      for (var i = 0; i < json.length; i++) {
        var geojson = new OpenLayers.Format.GeoJSON();
        var f       = geojson.read(json[i])[0];
        f.geometry.transform(proj4326,map.getProjectionObject());
        l.addFeatures(f);
      }
    }
  });
}

function addToHiliteCtl(lyr) {
  if (!hiliteCtl) {
    hiliteCtl = new OpenLayers.Control.SelectFeature(lyr,{
       hover          : true
      ,highlightOnly  : true
      ,renderIntent   : 'temporary'
      ,eventListeners : {
        beforefeaturehighlighted : function(e) {
          if (mouseoverObs && mouseoverObs.isVisible()) {
            mouseoverObs.hide();
          }
          var html;
          if (e.feature.attributes.dataset && e.feature.attributes.offering) {
            html = e.feature.attributes.dataset + ' : ' + e.feature.attributes.offering.shortName;
          }
          else {
            html = e.feature.attributes.storm + ' : ' + shortMonthDayStringWithTime(new Date(e.feature.attributes.t * 1000)) + '<br/>' + e.feature.attributes.cat;
          }
          var target = document.getElementById('OpenLayers.Geometry.Point_' + (Number(e.feature.id.split('_')[e.feature.id.split('_').length - 1]) - 1));
          if (target) {
            mouseoverObs = new Ext.ToolTip({
               html         : html
              ,anchor       : 'bottom'
              ,target       : target
              ,hideDelay    : 0
              ,listeners    : {hide : function(tt) {
                if (!tt.isDestroyed && !Ext.isIE) {
                  tt.destroy();
                }
              }}
            });
            mouseoverObs.show();
          }
        }
      }
    });
    map.addControl(hiliteCtl);
    hiliteCtl.activate();
  }
  else {
    var layers = [lyr];
    if (hiliteCtl.layers) {
      for (var i = 0; i < hiliteCtl.layers.length; i++) {
        layers.push(hiliteCtl.layers[i]);
      }
    }
    else {
      layers.push(hiliteCtl.layer);
    }
    hiliteCtl.setLayer(layers);
  }
}

function addToPopupCtl(lyr) {
  if (!popupCtl) {
    popupCtl = new OpenLayers.Control.SelectFeature(lyr,{
      eventListeners : {
        featurehighlighted : function(e) {
          if (popupObs && popupObs.isVisible()) {
            popupObs.hide();
          }
          var properties = getProperties(e.feature.attributes);
          if (!properties) {
            return;
          }
          var propertiesLinks = [];
          for (p in properties) {
            var shortP = p.split('/');
            shortP = shortP[shortP.length-1];
            shortP = shortP.substr(0,40) + (shortP.length > 40 ? '...' : '');
            propertiesLinks.push('<a href="#" onclick="getObs(\'' + e.feature.layer.name + '\',\'' + properties[p] + '\',\'' + p + '\',\'' + e.feature.attributes.offering.shortName + ' ' + e.feature.attributes.dataset + '\',' + e.feature.attributes.offering.llon + ',' + e.feature.attributes.offering.llat + ',true,\'' + (e.feature.attributes.targetProperties ? e.feature.attributes.targetProperties.getObsExtra : '') + '\')">' + shortP + '</a>');
          }
          var tr = [
             '<td><b>time&nbsp;range</b></td><td>' + shortDateStringNoTime(isoDateToDate(e.feature.attributes.offering.begin_time)) + '&nbsp;\u2011&nbsp;' + shortDateStringNoTime(isoDateToDate(e.feature.attributes.offering.end_time)) + '</td>'
            ,'<td><b>properties</b></td><td>' + propertiesLinks.join(', ') + '</td>'
            ,'<td><b>dataset</b></td><td>' + e.feature.attributes.dataset + '<br><a href="javascript:setCenterOnPoint(' + e.feature.attributes.offering.llon + ',' + e.feature.attributes.offering.llat + ')">zoom & recenter map to this site</a></td>'
          ];
          popupObs = new Ext.ToolTip({
             title     : e.feature.attributes.dataset + ' : ' + e.feature.attributes.offering.shortName
            ,items     : {bodyCssClass : 'obsPopup',html : '<table><tr>' + tr.join('</tr><tr>') + '</tr></table>'}
            ,anchor    : 'bottom'
            ,width     : 345
            ,target    : 'OpenLayers.Geometry.Point_' + (Number(e.feature.id.split('_')[e.feature.id.split('_').length - 1]) - 1)
            ,autoHide  : false
            ,closable  : true
            ,style     : {
              'z-index' : 5000 // keep the popup below any subsequent form 'popups'
            }
            ,listeners : {
              hide : function(tt) {
                if (!tt.isDestroyed) {
                  tt.destroy();
                }
                if (e.feature.layer) {
                  popupCtl.unselect(e.feature);
                }
              }
            }
          });
          popupObs.show();
          mapClick(map.getPixelFromLonLat(new OpenLayers.LonLat(e.feature.geometry.getCentroid().x,e.feature.geometry.getCentroid().y)));
        }
      }
    });
    map.addControl(popupCtl);
    popupCtl.activate();
  }
  else {
    var layers = [lyr];
    if (popupCtl.layers) {
      for (var i = 0; i < popupCtl.layers.length; i++) {
        layers.push(popupCtl.layers[i]);
      }
    }
    else {
      layers.push(popupCtl.layer);
    }
    popupCtl.setLayer(layers);
  }
}

function setMapTime() {
  Ext.getCmp('mapTime').setText(dNow.getUTCFullYear() + '-' + String.leftPad(dNow.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(dNow.getUTCDate(),2,'0') + ' ' + String.leftPad(dNow.getUTCHours(),2,'0') + ':00 UTC');
  for (var i = 0; i < map.layers.length; i++) {
    // WMS layers only
    if (map.layers[i].DEFAULT_PARAMS) {
      map.layers[i].mergeNewParams({TIME : makeTimeParam(dNow)});
    }
  }

  if (Ext.getCmp('datePicker')) {
    var dp = Ext.getCmp('datePicker');
    dp.suspendEvents();
    dp.setValue(new Date(dNow.getTime() + dNow.getTimezoneOffset() * 60000));
    dp.resumeEvents();
  }
}

function addTileCache(l) {
  var lyr = new OpenLayers.Layer.TileCache(
     l.name
    ,l.url
    ,l.layer
    ,{
       visibility        : l.visibility
      ,isBaseLayer       : false
      ,wrapDateLine      : true
      ,projection        : l.projection
      ,opacity           : 1
      ,scales            : [
         55468034.09273208   // ESRI Ocean zoom 3
        ,27734017.04636604
        ,13867008.52318302
        ,6933504.26159151
        ,3466752.130795755
        ,1733376.0653978775
        ,866688.0326989387
        ,433344.01634946937
        ,216672.00817473468
      ]
    }
  );
  lyr.getURL = function(bounds) {
    var res = this.map.getResolution();
    var bbox = this.maxExtent;
    var size = this.tileSize;
    var tileX = Math.round((bounds.left - bbox.left) / (res * size.w));
    var tileY = Math.round((bounds.bottom - bbox.bottom) / (res * size.h));
    var tileZ = this.serverResolutions != null ?
        OpenLayers.Util.indexOf(this.serverResolutions, res) :
        this.map.getZoom();
    // this is the trick
    tileZ += map.baseLayer.minZoomLevel ? map.baseLayer.minZoomLevel : 0;
    /**
     * Zero-pad a positive integer.
     * number - {Int}
     * length - {Int}
     *
     * Returns:
     * {String} A zero-padded string
     */
    function zeroPad(number, length) {
        number = String(number);
        var zeros = [];
        for(var i=0; i<length; ++i) {
            zeros.push('0');
        }
        return zeros.join('').substring(0, length - number.length) + number;
    }
    var components = [
        this.layername,
        zeroPad(tileZ, 2),
        zeroPad(parseInt(tileX / 1000000), 3),
        zeroPad((parseInt(tileX / 1000) % 1000), 3),
        zeroPad((parseInt(tileX) % 1000), 3),
        zeroPad(parseInt(tileY / 1000000), 3),
        zeroPad((parseInt(tileY / 1000) % 1000), 3),
        zeroPad((parseInt(tileY) % 1000), 3) + '.' + this.extension
    ];
    var path = components.join('/');
    var url = this.url;
    if (url instanceof Array) {
        url = this.selectUrl(path, url);
    }
    url = (url.charAt(url.length - 1) == '/') ? url : url + '/';
    return url + path;
  };
  addLayer(lyr,false);
}

function addLayer(lyr,timeSensitive) {
  if (timeSensitive) {
    lyr.mergeNewParams({TIME : makeTimeParam(dNow)});
  }
  map.addLayer(lyr);
}

function addGrid(url,lyr,syl,sgl,name,type) {
  if (map.getLayersByName(name)[0]) {
    var lyr = map.getLayersByName(name)[0];
    lyr.setVisibility(true);
    return;
  }

  var lyr = new OpenLayers.Layer.WMS(
     name
    ,url
    ,{
       layers      : lyr
      ,styles      : syl
      ,transparent : true
    }
    ,{
       isBaseLayer  : false
      ,projection   : proj3857
      ,singleTile   : sgl
      ,wrapDateLine : true
      ,visibility   : true
      ,opacity      : 1
    }
  );

  lyr.events.register('visibilitychanged',this,function(e) {
    if (!lyr.visibility) {
      var sto = Ext.getCmp('legendsGridPanel').getStore();
      var idx = sto.find('name',lyr.name);
      if (idx >= 0) {
        sto.removeAt(idx);
      }
      mapLoadendUnmask(lyr.name);
    }
  });
  lyr.events.register('loadstart',this,function(e) {
    mapLoadstartMask(lyr.name);
    var sto = Ext.getCmp('legendsGridPanel').getStore();
    var idx = sto.find('name',lyr.name);
    if (idx >= 0) {
      var rec = sto.getAt(idx);
      rec.set('status','loading');
      rec.commit();
    }
    else {
      var gridsStore = Ext.getCmp('gridsGridPanel').getStore();
      var rec = gridsStore.getAt(gridsStore.find('name',lyr.name));
      sto.add(new sto.recordType({
         name        : lyr.name
        ,displayName : rec.get('name')
        ,status      : 'loading'
      }));
    }
  });
  lyr.events.register('loadend',this,function(e) {
    mapLoadendUnmask(lyr.name);
    var sto = Ext.getCmp('legendsGridPanel').getStore();
    var idx = sto.find('name',lyr.name);
    if (idx >= 0) {
      var rec = sto.getAt(idx);
      OpenLayers.Request.GET({
         url      : 'getTimestamp.php?'
          + lyr.getFullRequestString({})
          + '&WIDTH='  + map.getSize().w
          + '&HEIGHT=' + map.getSize().h
          + '&BBOX=' +  map.getExtent().toArray().join(',')
          + '&' + new Date().getTime()
          + '&drawImg=false'
        ,callback : function(r) {
          if (r.responseText == '') {
            rec.set('timestamp','<span class="alert">There was a problem<br/>drawing this layer.<span>');
          }
          else if (r.responseText == 'invalidBbox') {
            rec.set('timestamp','<span class="alert">This layer\'s domain<br/>is out of bounds.<span>');
          }
          else if (r.responseText == 'dateNotAvailable') {
            rec.set('timestamp','');
          }
          else {
            var prevTs = rec.get('timestamp');
            var d = new Date(r.responseText * 1000);
            var newTs  = d.getUTCFullYear() + '-' + String.leftPad(d.getUTCMonth() + 1,2,'0') + '-' + String.leftPad(d.getUTCDate(),2,'0') + ' ' + String.leftPad(d.getUTCHours(),2,'0') + ':00 UTC';
            rec.set('timestamp',newTs);
            rec.set('jsDate',d);
          }
          rec.set('status','drawn');
          rec.commit();
        }
      });
    }
  });
  lyr.mergeNewParams({TIME : makeTimeParam(dNow)});

  map.addLayer(lyr);
}

function makeTimeParam(d) {
  return d.getUTCFullYear() 
    + '-' + String.leftPad(d.getUTCMonth() + 1,2,'0') 
    + '-' + String.leftPad(d.getUTCDate(),2,'0') 
    + 'T' 
    + String.leftPad(d.getUTCHours(),2,'0') 
    + ':00Z'
}

function setdNow(d) {
  dNow = new Date(d.getTime());
  dNow.setUTCMinutes(0);
  dNow.setUTCSeconds(0);
  dNow.setUTCMilliseconds(0);
  if (dNow.getHours() >= 12) {
    dNow.setUTCHours(12);
  }
  else {
    dNow.setUTCHours(0);
  }
}

function mapClick(xy) {
  lastMapClick['xy'] = xy;
  lyrQueryPts.removeFeatures(lyrQueryPts.features);

  var l = [];
  Ext.getCmp('legendsGridPanel').getStore().each(function(rec) {
    l.push(map.getLayersByName(rec.get('name'))[0]);
  });

  if (l.length == 0) {
    if (Ext.getCmp('stationGridTabPanel').getActiveTab().id == 'gridsTab') {
      Ext.Msg.alert('Query error','Please add at least one gridded dataset to the map before requesting a time series extraction.');
    }
  }
  else {
    var lonLat       = map.getLonLatFromPixel(xy);
    var f            = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lonLat.lon,lonLat.lat));
    f.attributes.img = 'Delete-icon.png';
    lyrQueryPts.addFeatures(f);
    queryWMS(xy,l);
  }
}

function queryWMS(xy,a) {
  lastMapClick['layer'] = a[0].name;
  var targets = [];
  var sto = Ext.getCmp('legendsGridPanel').getStore();
  var grdSto = Ext.getCmp('gridsGridPanel').getStore();
  for (var i = 0; i < a.length; i++) {
    var mapTime;
    var legIdx = sto.find('name',a[i].name);
    var grdIdx = grdSto.find('name',a[i].name);
    if (legIdx >= 0 && String(sto.getAt(legIdx).get('timestamp')).indexOf('alert') < 0) {
      var d = sto.getAt(legIdx).get('jsDate');
      if (d) {
        mapTime = '&mapTime=' + d.getTime() / 1000;
      }
      else {
        Ext.Msg.alert('Time series error',"We're sorry, but we could not perform a time series extraction.  If the layer is still loading, please wait until it has finished and retry.");
        return;
      }
    }
    var paramOrig = OpenLayers.Util.getParameters(a[i].getFullRequestString({}));
    var minT = new Date(grdSto.getAt(grdIdx).get('minT') * 1000);
    var maxT = new Date(grdSto.getAt(grdIdx).get('maxT') * 1000);
    var d = sto.getAt(legIdx).get('jsDate');
    if (d) {
      minT = new Date(d.getTime() - 3600 * 24 * 1000);
      maxT = new Date(d.getTime() + 3600 * 24 * 1000);
    }
    var paramNew = {
       REQUEST       : 'GetFeatureInfo'
      ,BBOX          : map.getExtent().toBBOX()
      ,X             : xy.x
      ,Y             : xy.y
      ,INFO_FORMAT   : 'text/xml'
      ,FEATURE_COUNT : 1
      ,WIDTH         : map.size.w
      ,HEIGHT        : map.size.h
      ,QUERY_LAYERS  : paramOrig['LAYERS']
      ,TIME          : makeTimeParam(minT) + '/' + makeTimeParam(maxT)
    };
    targets.push({
       url   : a[i].getFullRequestString(
          paramNew
         ,'getFeatureInfo.php?' + a[i].url 
           + '&tz=' + new Date().getTimezoneOffset() 
           + mapTime 
           + '&varName=' + grdSto.getAt(grdIdx).get('varName') 
           + '&varUnits=' + grdSto.getAt(grdIdx).get('varUnits')
       )
      ,title : sto.getAt(legIdx).get('displayName')
      ,type  : 'model'
    });
  }
  addToChart(targets);
}

function addToChart(a) {
  for (var j = 0; j < a.length; j++) {
    graphLoadstartMask(a[j].url);
    OpenLayers.Request.GET({
       url      : a[j].url
      ,callback : OpenLayers.Function.bind(addToChartCallback,null,a[j].title,a[j].url)
    });
  }
  function addToChartCallback(title,url,r) {
    graphLoadendUnmask(url);
    var obs = new OpenLayers.Format.JSON().read(r.responseText);
    if (obs && obs.error) {
      chartData.push({
         data   : []
        ,label  : title.split('||')[0] + ': QUERY ERROR ' + obs.error
        ,id     : Ext.id()
      });
    }
    else if (!obs || obs.d == '' || obs.d.length == 0) {
      chartData.push({
         data   : []
        ,label  : title.split('||')[0] + ': QUERY ERROR'
        ,id     : Ext.id()
      });
    }
    else {
      // get rid of any errors if good, new data has arrived
      if (chartData.length == 1 && String(chartData[0]).indexOf('QUERY ERROR') == 0) {
        chartData.pop();
      }
      for (var v in obs.d) {
        // get the data
        chartData.push({
           data   : []
          ,label  : title.split('||')[0] + ' : ' + v + ' (' + obs.u[v] + ')'
          ,lines  : {show : true}
          ,id     : Ext.id()
        });
        for (var i = 0; i < obs.d[v].length; i++) {
          chartData[chartData.length-1].data.push([obs.t[i],obs.d[v][i]]);
        }
        if (obs.d[v].length == 1) {
          chartData[chartData.length - 1].points = {show : true};
        }
      }
    }
    Ext.getCmp('timeseriesPanel').fireEvent('resize',Ext.getCmp('timeseriesPanel'));
  }
}

function toEnglish(v) {
  if (String(v.src).indexOf('Celcius') >= 0) {
    if (v.typ == 'title') {
      return v.val.replace('Celcius','Fahrenheit');
    }
    else {
      return v.val * 9/5 + 32;
    }
  }
  else if (String(v.src).indexOf('Meters') >= 0) {
    if (v.typ == 'title') {
      return v.val.replace('Meters','Feet');
    }
    else {
      return v.val * 3.281;
    }
  }
  return v.val;
}

function goLayerCallout(name) {
  if (!Ext.getCmp('info.popup.' + name) || !Ext.getCmp('info.popup.' + name).isVisible()) {
    var customize = '<a class="blue-href-only" href="javascript:setLayerSettings(\'' + name + '\')"><img width=32 height=32 src="img/settings_tools_big.png"><br>Customize<br>appearance</a>';
    if (!new RegExp(/^grid\./).test(name)) {
      customize = '<img width=32 height=32 src="img/settings_tools_big_disabled.png"><br><font color="lightgray">Customize<br>appearance</font>';
    }
    new Ext.ToolTip({
       id        : 'info.popup.' + name
      ,title     : name
      ,anchor    : 'right'
      ,target    : 'info.' + name
      ,autoHide  : false
      ,closable  : true
      ,width     : 250
      ,items     : {
         layout   : 'column'
        ,defaults : {border : false}
        ,height   : 75
        ,bodyStyle : 'padding:6'
        ,items    :  [
           {columnWidth : 0.33,items : {xtype : 'container',autoEl : {tag : 'center'},items : {border : false,html : '<a class="blue-href-only" href="javascript:zoomToBbox(\'' + name + '\')"><img width=32 height=32 src="img/find_globe_big.png"><br>Zoom<br>to layer</a>'}}}
          ,{columnWidth : 0.34,items : {xtype : 'container',autoEl : {tag : 'center'},items : {border : false,html : customize}}}
          ,{columnWidth : 0.33,items : {xtype : 'container',autoEl : {tag : 'center'},items : {border : false,html : '<a class="blue-href-only" href="javascript:showLayerInfo(\'' + name + '\')"><img width=32 height=32 src="img/document_image.png"><br>Layer<br>information</a>'}}}
        ]
      }
      ,listeners : {
        hide : function() {
          this.destroy();
        }
      }
    }).show();
  }
}

function destroyLayerCallout(name) {
  if (Ext.getCmp('info.popup.' + name) && Ext.getCmp('info.popup.' + name).isVisible()) {
     Ext.getCmp('info.popup.' + name).destroy();
  }
}

function zoomToBbox(name) {
  destroyLayerCallout(name);
  var sto = Ext.getCmp('gridsGridPanel').getStore();
  var idx = sto.find('name',name);
  if (idx >= 0) {
    var p = sto.getAt(idx).get('bbox').split(',');
    map.zoomToExtent(new OpenLayers.Bounds(p[0],p[1],p[2],p[3]).transform(proj4326,map.getProjectionObject()));
  }
}

function showLayerInfo(name) {
  destroyLayerCallout(name);
  if (!activeInfoWindows[name]) {
    var sto = Ext.getCmp('gridsGridPanel').getStore();
    var idx = sto.find('name',name);
    if (idx >= 0) {
      var pos = getOffset(document.getElementById('info.' + name));
      activeInfoWindows[name] = new Ext.Window({
         width      : 400
        ,x          : pos.left
        ,y          : pos.top
        ,autoScroll : true
        ,constrainHeader : true
        ,title      : name.split('.').slice(1) + ' :: info'
        ,items      : {border : false,bodyCssClass : 'popup',html : sto.getAt(idx).get('abstract')}
        ,listeners  : {hide : function() {
          activeInfoWindows[name] = null;
        }}
      }).show();
    }
  }
}

function setLayerSettings(name) {
  var sto = Ext.getCmp('gridsGridPanel').getStore();
  var idx = sto.find('name',name);
  var lyr = map.getLayersByName(name)[0];
  if (lyr && idx >= 0 && !activeSettingsWindows[name]) {
    var customize = sto.getAt(idx).get('customize');
    var styles    = OpenLayers.Util.getParameters(lyr.getFullRequestString({}))['STYLES'].split('-');
    var pos       = getOffset(document.getElementById('info.' + name));
    var height    = 26;
    var id        = Ext.id();

    var items     = [
      new Ext.Slider({
         fieldLabel : 'Opacity<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.opacity' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.opacity' + '" src="img/info.png"></a>'
        ,id       : 'opacity.' + id
        ,width    : 130
        ,minValue : 0
        ,maxValue : 100
        ,value    : lyr.opacity * 100
        ,plugins  : new Ext.slider.Tip({
          getText : function(thumb) {
            return String.format('<b>{0}%</b>', thumb.value);
          }
        })
        ,listeners : {
          afterrender : function() {
            new Ext.ToolTip({
               id     : 'tooltip.' + id + '.opacity'
              ,target : id + '.opacity'
              ,html   : "Use the slider to adjust the layer's opacity.  The lower the opacity, the greater the transparency."
            });
          }
          ,change : function(slider,val) {
            lyr.setOpacity(val / 100);
          }
        }
      })
    ];

    if (typeof customize.imageQuality == 'number') {
      height += 27;
      items.push(
        new Ext.form.ComboBox({
           fieldLabel     : 'Image quality<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.imageQuality' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.imageQuality' + '" src="img/info.png"></a>'
          ,id             : 'imageType.' + id
          ,store          : new Ext.data.ArrayStore({
            fields : [
              'name'
             ,'value'
            ]
            ,data : [
               ['Low' ,'Low']
              ,['High','High']
            ]
          })
          ,displayField   : 'name'
          ,valueField     : 'value'
          ,value          : styles[customize.imageQuality]
          ,editable       : false
          ,triggerAction  : 'all'
          ,mode           : 'local'
          ,width          : 130
          ,forceSelection : true
          ,listeners      : {
            afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.imageQuality'
                ,target : id + '.imageQuality'
                ,html   : "Selecting high quality may result in longer download times."
              });
              this.addListener('select',function(el,rec) {
                setCustomStyle(lyr,{imageQuality : rec.get('value')},customize);
              });
            }
          }
        })
      )
    }

    if (typeof customize.baseStyle == 'number') {
      height += 27;
      items.push(
        new Ext.form.ComboBox({
           fieldLabel     : 'Base style<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.baseStyle' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.baseStyle' + '" src="img/info.png"></a>'
          ,id             : 'baseStyle.' + id
          ,store          : new Ext.data.ArrayStore({
            fields : [
              'name'
             ,'value'
             ,'type'
	    ]
	    ,data : [
               ['Ramp','CURRENTS_RAMP','CURRENTS']
              ,['Black','CURRENTS_STATIC_BLACK','CURRENTS']
              ,['Green','WINDS_VERY_SPARSE_GREEN','WINDS']
              ,['Purple','WINDS_VERY_SPARSE_PURPLE','WINDS']
              ,['Yellow','WINDS_VERY_SPARSE_YELLOW','WINDS']
              ,['Orange','WINDS_VERY_SPARSE_ORANGE','WINDS']
              ,['Gradient','WINDS_VERY_SPARSE_GRADIENT','WINDS']
            ]
          })
          ,displayField   : 'name'
          ,valueField     : 'value'
          ,value          : styles[customize.baseStyle]
          ,editable       : false
          ,triggerAction  : 'all'
          ,mode           : 'local'
          ,width          : 130
          ,forceSelection : true
          ,lastQuery      : ''
          ,listeners      : {
            beforerender : function(cb) {
              cb.getStore().filter('type',styles[customize.baseStyle].split('_')[0]);
            }
            ,afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.baseStyle'
                ,target : id + '.baseStyle'
                ,html   : "In general, the Black base style has a better appearance if high resolution is also selected."
              });
              this.addListener('select',function(el,rec) {
                if (rec.get('value') == 'CURRENTS_STATIC_BLACK' && Ext.getCmp('colorMap.') + id) {
                  Ext.getCmp('colorMap.' + id).disable();
                }
                else if (Ext.getCmp('colorMap.') + id) {
                  Ext.getCmp('colorMap.' + id).enable();
                }
                setCustomStyle(lyr,{baseStyle : rec.get('value')},customize);
              });
            }
          }
        })
      )
    }

    if (typeof customize.colorMap == 'number') {
      height += 27;
      items.push(
        new Ext.form.ComboBox({
           fieldLabel     : 'Colormap<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.colormap' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.colormap' + '" src="img/info.png"></a>'
          ,id             : 'colorMap.' + id
          ,disabled       : styles[customize.baseStyle] == 'CURRENTS_STATIC_BLACK'
          ,store          : new Ext.data.ArrayStore({
            fields : [
              'name'
            ]
            ,data : [
               ['Jet']
              ,['NoGradient']
              ,['Gray']
              ,['Blue']
              ,['Cool']
              ,['Hot']
              ,['Summer']
              ,['Winter']
              ,['Spring']
              ,['Autumn']
            ]
          })
          ,displayField   : 'name'
          ,valueField     : 'name'
          ,value          : styles[customize.colorMap]
          ,editable       : false
          ,triggerAction  : 'all'
          ,mode           : 'local'
          ,width          : 130
          ,forceSelection : true
          ,listeners      : {
            afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.colormap'
                ,target : id + '.colormap'
                ,html   : "Feature contrasts may become more obvious based on the selected colormap."
              });
              this.addListener('select',function(el,rec) {
                setCustomStyle(lyr,{colorMap : rec.get('name')},customize);
              });
            }
          }
        })
      )
    }

    if (typeof customize.minMaxBounds == 'string') {
      height += 27;
      items.push(
        new Ext.slider.MultiSlider({
           fieldLabel : 'Min/max<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.minMax' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.minMax' + '" src="img/info.png"></a>'
          ,id       : 'minMax.' + id
          ,width    : 130
          ,minValue : customize.minMaxBounds.split('-')[0]
          ,maxValue : customize.minMaxBounds.split('-')[1]
          ,decimalPrecision : 1
          ,values   : [styles[customize.min],styles[customize.max]]
          ,plugins  : new Ext.slider.Tip({
            getText : function(thumb) {
              return String.format('<b>{0}</b>', thumb.value);
            }
          })
          ,listeners : {
            afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.minMax'
                ,target : id + '.minMax'
                ,html   : "Use the slider to adjust the layer's minimum and maximum values."
              });
              this.addListener('change',function(el) {
                setCustomStyle(lyr,{'min' : el.getValues()[0],'max' : el.getValues()[1]},customize);
              });
            }
          }
        })
      )
    }

    if (typeof customize.striding == 'number') {
      height += 27;

      var sto = new Ext.data.ArrayStore({
        fields : [
          'index','param'
        ]
        ,data : [
           [0,0.25]
          ,[1,0.33]
          ,[2,0.50]
          ,[3,1.00]
          ,[4,2.00]
          ,[5,3.00]
          ,[6,4.00]
        ]
      });

      items.push(
        new Ext.Slider({
           fieldLabel : 'Data density<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.striding' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.striding' + '" src="img/info.png"></a>'
          ,id       : 'striding.' + id
          ,width    : 130
          ,minValue : 0
          ,maxValue : sto.getCount() - 1
          ,value    : styles[customize.striding]
          ,plugins  : new Ext.slider.Tip({
            getText : function(thumb) {
              var pct = sto.getAt(thumb.value).get('param');
              var s;
              if (thumb.value == 0) {
                s = 'sparsest';
              }
              else if (pct < 1) {
                s = 'sparser';
              }
              else if (pct == 1) {
                s = 'normal';
              }
              else if (thumb.value < sto.getCount() - 1) {
                s = 'denser';
              }
              else if (thumb.value == sto.getCount() - 1) {
                s = 'densest';
              }
              return String.format('<b>{0}</b>',s);
            }
          })
          ,listeners : {
            afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.striding'
                ,target : id + '.striding'
                ,html   : "Adjust the space between vectors with the data density factor.  The impact of this value varies based on the zoom level."
              });
              this.addListener('change',function(el,val) {
                setCustomStyle(lyr,{'striding' : sto.getAt(val).get('param')},customize);
              });
            }
          }
        })
      )
    }

    if (typeof customize.tailMag == 'number') {
      height += 27;
      items.push(
        new Ext.form.ComboBox({
           fieldLabel     : 'Tail magnitude<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.tailMagnitude' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.tailMagnitude' + '" src="img/info.png"></a>'
          ,id             : 'tailMag.' + id
          ,store          : new Ext.data.ArrayStore({
            fields : [
              'name'
            ]
            ,data : [
               ['True']
              ,['False']
            ]
          })
          ,displayField   : 'name'
          ,valueField     : 'name'
          ,value          : styles[customize.tailMag]
          ,editable       : false
          ,triggerAction  : 'all'
          ,mode           : 'local'
          ,width          : 130
          ,forceSelection : true
          ,listeners      : {
            afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.tailMagnitude'
                ,target : id + '.tailMagnitude'
                ,html   : "Choose whether or not the vector tail length will vary based on its magnitude.  The difference may be subtle in layers with small magnitude variability." 
              });
              this.addListener('select',function(el,rec) {
                setCustomStyle(lyr,{'tailMag' : rec.get('name')},customize);
              });
            }
          }
        })
      )
    }

    if (typeof customize.barbLabel == 'number') {
      height += 27;
      items.push(
        new Ext.form.ComboBox({
           fieldLabel     : 'Magnitude label<a href="javascript:Ext.getCmp(\'tooltip.' + id + '.magnitudeLabel' + '\').show()"><img style="margin-left:2px;margin-bottom:2px" id="' + id + '.magnitudeLabel' + '" src="img/info.png"></a>'
          ,id             : 'barbLabel.' + id
          ,store          : new Ext.data.ArrayStore({
            fields : [
              'name'
            ]
            ,data : [
               ['True']
              ,['False']
            ]
          })
          ,displayField   : 'name'
          ,valueField     : 'name'
          ,value          : styles[customize.barbLabel]
          ,editable       : false
          ,triggerAction  : 'all'
          ,mode           : 'local'
          ,width          : 130
          ,forceSelection : true
          ,listeners      : {
            afterrender : function(el) {
              new Ext.ToolTip({
                 id     : 'tooltip.' + id + '.magnitudeLabel'
                ,target : id + '.magnitudeLabel'
                ,html   : "Choose whether or not a text label should be drawn by each vector to identify its magnitude."
              });
              this.addListener('select',function(el,rec) {
                setCustomStyle(lyr,{'barbLabel' : rec.get('name')},customize);
              });
            }
          }
        })
      )
    }

    activeSettingsWindows[name] = new Ext.Window({
       bodyStyle : 'background:white;padding:5'
      ,x         : pos.left
      ,y         : pos.top
      ,resizable : false
      ,width     : 270
      ,constrainHeader : true
      ,title     : name.split('.').slice(1) + ' :: settings'
      ,items     : [
         new Ext.FormPanel({buttonAlign : 'center',border : false,bodyStyle : 'background:transparent',width : 240,height : height + 35,labelWidth : 100,labelSeparator : '',items : items,buttons : [{text : 'Restore default settings',width : 150,handler : function() {restoreDefaultStyles(lyr)}}]})
      ]
      ,listeners : {hide : function() {
        activeSettingsWindows[name] = null;
      }}
    }).show();
  }
  else {
    Ext.Msg.alert('Settings error','Please check this layer ON before adjusting its settings.');
  }

  destroyLayerCallout(name);
}

function setCustomStyle(lyr,style,customize) {
  var styles = OpenLayers.Util.getParameters(lyr.getFullRequestString({}))['STYLES'].split('-');
  for (var s in style) {
    styles[customize[s]] = style[s];
  }
  lyr.mergeNewParams({STYLES : styles.join('-')});
  var sto = Ext.getCmp('gridsGridPanel').getStore();
  var idx = sto.find('name',lyr.name);
  if (idx >= 0) {
    var rec = sto.getAt(idx);
    var p = OpenLayers.Util.getParameters(sto.getAt(idx).get('leg'));
    p['STYLES'] = styles.join('-');
    var a = [];
    for (var i in p) {
      a.push(i + '=' + p[i]);
    }
    rec.set('leg',sto.getAt(idx).get('leg').split('?')[0] + '?' + a.join('&'));
    rec.commit();
  }
}

function restoreDefaultStyles(lyr,winId) {
  var sto = Ext.getCmp('gridsGridPanel').getStore();
  var idx = sto.find('name',lyr.name);
  if (idx >= 0) {
    lyr.mergeNewParams({STYLES : sto.getAt(idx).get('stl')});
  }
  activeSettingsWindows[lyr.name].hide();
  setLayerSettings(lyr.name);
}

function getOffset(el) {
  var _x = 0;
  var _y = 0;
  while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
    _x += el.offsetLeft - el.scrollLeft;
    _y += el.offsetTop - el.scrollTop;
    el = el.offsetParent;
  }
  return {top: _y,left: _x};
}
