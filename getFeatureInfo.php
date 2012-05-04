<?php
  date_default_timezone_set('UTC');

  $xml = @simplexml_load_file(substr($_SERVER["REQUEST_URI"],strpos($_SERVER["REQUEST_URI"],'?')+1));

  $mapTime = $_REQUEST['mapTime'] != 'undefined' ? $_REQUEST['mapTime'] : '';

  $data = array();
  $data['t'] = array();
  $data['u'] = array();
  $data['d'] = array();

  if ($xml->{'ServiceException'}) {
    $data['error'] = sprintf("%s",$xml->{'ServiceException'}->attributes()->{'code'});
  }
  else if ($xml->{'Point'}) {
    foreach ($xml->{'Point'} as $p) {
      $a = preg_split("/-| |:/",sprintf("%s",$p->{'Time'}[0]));
      $t = mktime($a[3],$a[4],$a[5],$a[0],$a[1],$a[2]) - $_REQUEST['tz'] * 60;
      if ($mapTime == $t) {
        $data['nowIdx'] = count($data['t']);
      }
      array_push($data['t'],$t * 1000);
      foreach ($p->{'Value'} as $v) {
        $vStr = sprintf("%s",$v->attributes()->{'Var'});
        if (!array_key_exists($vStr,$data['d'])) {
          $data['d'][$vStr] = array(sprintf("%f",$v));
          $data['u'][$vStr] = sprintf("%s",$v->attributes()->{'Unit'});
        }
        else {
          array_push($data['d'][$vStr],sprintf("%f",$v));
        }
      }
    }
  }
  else if ($xml->{'FeatureInfo'}) {
    foreach ($xml->{'FeatureInfo'} as $p) {
      if (sprintf("%s",$p->{'value'}[0]) != 'none') {
        $t = strtotime($p->{'time'}[0]) - $_REQUEST['tz'] * 60;
        if ($mapTime == $t) {
          $data['nowIdx'] = count($data['t']);
        }
        array_push($data['t'],$t * 1000);
        $vStr = $_REQUEST['varName'];
        if (!array_key_exists($vStr,$data['d'])) {
          $data['d'][$vStr] = array(sprintf("%f",$p->{'value'}[0]));
          $data['u'][$vStr] = $_REQUEST['varUnits'];
        }
        else {
          array_push($data['d'][$vStr],array(sprintf("%f",$p->{'value'}[0])));
        }
      }
    }
  }

  echo json_encode($data);
?>
