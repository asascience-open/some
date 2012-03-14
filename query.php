<?php
  header('Content-type:application/json');

  date_default_timezone_set('UTC');
  $today = mktime(0,0,0);

  $eventTime = explode('/',$_REQUEST['eventtime']);
  $eventTime = array(
     $eventTime[0]
    ,$eventTime[1]
  );

  $models = array(
    array(
       'name' => 'model.elevation_gomaine.nc'
      ,'url'  => 'xml/elevation_gomaine.xml'
      // ,'url' => 'http://mcqueen.gomoos.org:8080/oostethys/sos?VERSION=1.0.0&SERVICE=SOS&REQUEST=GetCapabilities'
      ,'minT' => date('Y-m-d',$today).'T'.date('H:i:s',$today).'Z'
      ,'maxT' => date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z'
    )
    ,array(
       'name' => 'model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc'
      ,'url'  => 'xml/model.watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc.getcaps.xml'
      // ,'url' => 'http://testbedapps-dev.sura.org/thredds/sos/alldata/acrosby/watlev_CRMS_2008.F.C__IKE_VIMS_3D_WITHWAVE.nc?service=sos&version=1.0.0&request=GetCapabilities'
      ,'minT' => '2008-09-08T00:30Z'
      ,'maxT' => '2008-09-16T00:00Z'
    )
  );

  $obs = array(
    array(
       'name' => 'obs.coops'
      ,'url'  => 'xml/coops.xml'
      // ,'url' => 'http://opendap.co-ops.nos.noaa.gov/ioos-dif-sos/SOS?service=SOS&request=GetCapabilities'
      ,'minT' => '1970-02-01T00:00Z'
      ,'maxT' => date('Y-m-d',$today + 3600 * 24 * 2).'T'.date('H:i:s',$today + 3600 * 24 * 2).'Z'
    )
    ,array(
       'name' => 'obs.watlev_CRMS_2008.F.C.nc'
      ,'url'  => 'xml/obs.watlev_CRMS_2008.F.C.nc.getcaps.xml'
      // ,'url' => 'http://testbedapps-dev.sura.org/thredds/sos/alldata/acrosby/watlev_CRMS_2008.F.C.nc?service=sos&version=1.0.0&request=GetCapabilities
      ,'minT' => '2008-09-08T00:30Z'
      ,'maxT' => '2008-09-16T00:00Z'
    )
  );

  $data = array();
  if ($_REQUEST['type'] == 'models') {
    for ($i = 0; $i < count($models); $i++) {
      if ((strtotime($eventTime[0]) <= strtotime($models[$i]['maxT'])) && (strtotime($eventTime[1]) >= strtotime($models[$i]['minT']))) {
        array_push($data,$models[$i]);
      }
    }
  }
  if ($_REQUEST['type'] == 'obs') {
    for ($i = 0; $i < count($obs); $i++) {
      if ((strtotime($eventTime[0]) <= strtotime($obs[$i]['maxT'])) && (strtotime($eventTime[1]) >= strtotime($obs[$i]['minT']))) {
        array_push($data,$obs[$i]);
      }
    }
  }

  echo json_encode(array('data' => $data));
?>
