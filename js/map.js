var map;
var proj900913 = new OpenLayers.Projection("EPSG:900913");
var proj4326   = new OpenLayers.Projection("EPSG:4326");
var sitesHilite;
var chartData = [];

var toc = {
   'obs.watlev_CRMS_2008.F.C.nc' : 'xml/obs.watlev_CRMS_2008.F.C.nc.getcaps.xml' // 'http://testbedapps-dev.sura.org/thredds/sos/alldata/acrosby/watlev_CRMS_2008.F.C.nc?service=sos&version=1.0.0&request=GetCapabilities'
  ,'model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc' : 'xml/model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc.getcaps.xml' // 'http://testbedapps-dev.sura.org/thredds/sos/alldata/acrosby/watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc?service=sos&version=1.0.0&request=GetCapabilities'
};

function getCaps(url,name) {

  function getCapsCallback(l,r) {
    document.getElementById(name).disabled = false;
    document.getElementById(name + '.loading').src = 'img/blank.png';
    var sos = new SOSCapabilities(new OpenLayers.Format.XML().read(r.responseText));
    if (sos.type === 'EXCEPTION') {
      alert('SOS exception : ' + sos.exception_error);
      return;
    }
    for (var i = 0; i < sos.offerings.length; i++) {
      var f = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(sos.offerings[i].llon,sos.offerings[i].llat).transform(proj4326,map.getProjectionObject()));
      f.attributes = {
         type     : 'getCaps'
        ,offering : sos.offerings[i]
        ,dataset  : name
      };
      if (name.indexOf('model.') >= 0) {
        f.style = OpenLayers.Feature.Vector.style['delete'];
      }
      l.addFeatures(f);
    }
    document.getElementById(name + '.count').innerHTML = '(' + sos.offerings.length + ' hits)';
    addToSitesControl(l);
  }

  var l = map.getLayersByName(name)[0];
  if (!l) {
    document.getElementById(name).disabled = true;
    document.getElementById(name + '.loading').src = 'img/loading.gif';
    var l = new OpenLayers.Layer.Vector(
       name
      ,{
        styleMap : new OpenLayers.StyleMap({
          'default' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
             pointRadius     : 6
            ,fillColor       : '#e8bb99'
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#b56529'
            ,strokeOpacity   : 1
          }))
          ,'select' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
             pointRadius     : 6
            ,fillColor       : '#99e9ae'
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#1d8538'
            ,strokeOpacity   : 1
          }))
          ,'temporary' : new OpenLayers.Style(OpenLayers.Util.applyDefaults({
             pointRadius     : 6
            ,fillColor       : '#99BBE8'
            ,fillOpacity     : 0.7
            ,strokeWidth     : 1
            ,strokeColor     : '#1558BB'
            ,strokeOpacity   : 1
          }))
        })
      }
    );
    map.addLayer(l);
    OpenLayers.Request.issue({
       url      : url // 'get.php?u=' + encodeURIComponent(url)
      ,callback : OpenLayers.Function.bind(getCapsCallback,null,l)
    });
  }
  else {
    l.setVisibility(!l.visibility);
    nd();
  }
}

function getObsCallback(property,name,r) {
  var sos = new SOSObservation(new OpenLayers.Format.XML().read(r.responseText));
  if (sos.type === 'EXCEPTION') {
    alert('SOS exception : ' + sos.exception_error);
    return;
  }
  var d = [];
  for (var i = 0; i < sos.observations.length; i++) {
    var t = isoDateToDate(sos.observations[i].time);
    if (t) {
      d.push([t.getTime(),sos.observations[i][property]]);
    }
  }
  if (d.length > 0) {
    var uom;
    for (var i = 0; i < sos.fields.length; i++) {
      if (sos.fields[i].name == property) {
        uom = ' (' + sos.fields[i].uom + ')';
      }
    }
    chartData.push({
       data  : d
      ,label : property + ' ' + name + uom
      ,lines : {show : true}
    });
  }
  $.plot(
     $('#chart')
    ,chartData
    ,{
       xaxis : {mode : 'time'}
      ,pan   : {interactive : true}
    }
  );
  document.getElementById('clearChart').style.visibility = 'visible';
}

function getObs(url,property,name,lon,lat) {
  OpenLayers.Request.issue({
     url      : 'get.php?u=' + encodeURIComponent(url)
    ,callback : OpenLayers.Function.bind(getObsCallback,null,property,name)
  });

  // if this is an obs, go find the nearest model point to plot
  if (name.indexOf('obs.') >= 0) {
    var p0 = new OpenLayers.Geometry.Point(lon,lat).transform(proj4326,map.getProjectionObject());
    var d;
    var f;
    for (var i = 0; i < map.layers.length; i++) {
      if (map.layers[i].name.indexOf('model.') >= 0) {
        for (var j = 0; j < map.layers[i].features.length; j++) {
          if (typeof d != 'number' || p0.distanceTo(map.layers[i].features[j].geometry) < d) {
            d = p0.distanceTo(map.layers[i].features[j].geometry);
            f = map.layers[i].features[j];
          }
        }
        if (typeof d == 'number') {
          var properties = getProperties(f.attributes);
          for (p in properties) {
            if (p == property) {
              getObs(properties[p],p,f.attributes.offering.shortName + ' ' + f.attributes.dataset,f.attributes.llon,f.attributes.llat);
            }
          }
        }
      }
    }
  }
}

function addToSitesControl(l) {
  if (!sitesHilite) {
    sitesHilite = new OpenLayers.Control.SelectFeature(l,{
       highlightOnly  : true
      ,hover          : true
      ,eventListeners : {
        featurehighlighted : function(e) {
          var a = preparePopup(e.feature.attributes);
          overlib(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7]);
        }
        ,featureunhighlighted : function(e) {
          nd();
        }
      }
    });
    map.addControl(sitesHilite);
    sitesHilite.activate();
  }
  else {
    var layers = [l];
    if (sitesHilite.layers) {
      for (var j = 0; j < sitesHilite.layers.length; j++) {
        layers.push(sitesHilite.layers[j]);
      }
    }
    else {
      layers.push(sitesHilite.layer);
    }
    sitesHilite.setLayer(layers);
  }
}

function getProperties(attr) {
  var p = {};
  attr.offering.properties.sort();
  for (var i = 0; i < attr.offering.properties.length; i++) {
    p[attr.offering.properties[i]] = attr.offering.getObsUrl(attr.offering.properties[i]) + '&eventtime=' + attr.offering.begin_time + '/' + attr.offering.end_time;
  }
  return p;
}

function preparePopup(attr) {
  var properties = getProperties(attr);
  var propertiesLinks = [];
  for (p in properties) {
    propertiesLinks.push('<a href="#" onclick="getObs(\'' + properties[p] + '\',\'' + p + '\',\'' + attr.offering.shortName + ' ' + attr.dataset + '\',' + attr.offering.llon + ',' + attr.offering.llat + ')">' + p + '</a>');
  }
  var rows = [
     '<td class="popup"><b>time&nbsp;range</b></td><td class="popup">' + shortDateStringNoTime(isoDateToDate(attr.offering.begin_time)) + '&nbsp;\u2011&nbsp;' + shortDateStringNoTime(isoDateToDate(attr.offering.end_time)) + '</td>'
    ,'<td class="popup"><b>properties</b></td><td class="popup">' + propertiesLinks.join(',') + '</td>'
    ,'<td class="popup"><b>dataset</b></td><td class="popup">' + attr.dataset + '</td>'
  ];
  return [
     '<table class="popup" style="width:100%"><tr>' + rows.join('</tr><tr>') + '</tr></table>'
    ,CAPTION,attr.offering.shortName,VAUTO,HAUTO
    ,STICKY,CLOSECOLOR,'#ffffff'
  ];
}

function populateTOC() {
  var tbody = document.getElementById('toc').getElementsByTagName('tbody')[0];
  for (var name in toc) {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    var img = document.createElement('img');
    img.id = name + '.loading';
    img.style.height = 16;
    img.style.width  = 16;
    img.src = 'img/blank.png';
    td.appendChild(img);
    var cbox = document.createElement('input');
    cbox.type = 'checkbox';
    cbox.id   = name;
    cbox.onclick = function() {
      getCaps(toc[this.id],this.id);
    }
    var label = document.createElement('label');
    label.htmlFor = name;
    label.appendChild(document.createTextNode(name));
    td.appendChild(cbox);
    td.appendChild(label);
    tr.appendChild(td);
    td = document.createElement('td');
    var span = document.createElement('span');
    span.id = name + '.count';
    td.appendChild(span);
    tr.appendChild(td);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
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
  return (d.getUTCMonth() + 1)
    + '/' + d.getUTCDate()
    + '/' + d.getUTCFullYear();
}

function clearChart() {
  chartData = [];
  document.getElementById('chart').innerHTML = '';
  document.getElementById('clearChart').style.visibility = 'hidden';
}

function init() {
  populateTOC();

  map = new OpenLayers.Map('map',{
     projection        : proj900913
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
    ,layers            : [
       new OpenLayers.Layer.Google('Google',{
         type       : google.maps.MapTypeId.SATELLITE
        ,projection : proj900913
      })
    ]
  });
  map.setCenter(new OpenLayers.LonLat(-90,24).transform(proj4326,proj900913),5);
}
