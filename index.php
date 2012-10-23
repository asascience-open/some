<html>
  <head>
    <title>SURA Testbed Explorer</title>
    <meta http-equiv="X-UA-Compatible" content="chrome=1">
    <link rel="stylesheet" type="text/css" href="./js/ext-3.3.0/resources/css/ext-all.css"/>
    <link rel="stylesheet" type="text/css" href="./js/ext-3.3.0/treegrid/treegrid.css"/>
    <link rel="stylesheet" type="text/css" href="style.css"/>
    <!--[if IE]>
      <link rel="stylesheet" type="text/css" href="style.ie.css" />
    <![endif]-->
  </head>
  <body onload="Ext.onReady(function(){init()})">
    <div id="loading-mask"></div>
    <div id="loading">
      <span id="loading-message">Loading core API. Please wait...</span>
    </div>
    <script type="text/javascript" src="http://maps.google.com/maps/api/js?sensor=false"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/adapter/ext/ext-base.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/ext-all.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/treegrid/TreeGridSorter.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/treegrid/TreeGridColumnResizer.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/treegrid/TreeGridNodeUI.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/treegrid/TreeGridLoader.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/treegrid/TreeGridColumns.js"></script>
    <script type="text/javascript" src="./js/ext-3.3.0/treegrid/TreeGrid.js"></script>
    <script type="text/javascript" src="./js/OpenLayers-2.12/OpenLayers-closure.js"></script>
    <script type="text/javascript" src="./js/jquery/jquery-1.7.1.min.js"></script>
    <script type="text/javascript" src="./js/jquery/jquery.parseSOSGetCap.js"></script>
    <script type="text/javascript" src="./js/jquery/jquery.parseSOSGetObs.js"></script>
    <script type="text/javascript" src="./js/jquery/jquery.flot.js"></script>
    <script type="text/javascript" src="./js/jquery/jquery.flot.crosshair.js"></script>
    <script type="text/javascript" src="map.js"></script>
  </body>
</html>
