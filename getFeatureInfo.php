<?php
  date_default_timezone_set('UTC');

  $gfiUrl  = substr($_SERVER["REQUEST_URI"],strpos($_SERVER["REQUEST_URI"],'?')+1);
  $rawData = file_get_contents($gfiUrl);

  $mapTime = $_REQUEST['mapTime'] != 'undefined' ? $_REQUEST['mapTime'] : '';

  $data      = array();
  $data['t'] = array();
  $data['u'] = array();
  $data['d'] = array();

  $xml = false;
  if (preg_match('/text\/xml/i',$_REQUEST['FORMAT'])) {
    $xml = @simplexml_load_string($rawData);
  }

  if ($xml && $xml->{'ServiceException'}) {
    $data['error'] = sprintf("%s",$xml->{'ServiceException'}->attributes()->{'code'});
  }
  else if ($xml && $xml->{'Point'}) {
    foreach ($xml->{'Point'} as $p) {
      $a = preg_split("/-| |:/",sprintf("%s",$p->{'Time'}[0]));
      $t = mktime($a[3],$a[4],$a[5],$a[0],$a[1],$a[2]) - $_REQUEST['tz'] * 60;
      if ($mapTime == $t) {
        $data['nowIdx'] = count($data['t']);
      }
      array_push($data['t'],$t * 1000);
      foreach ($p->{'Value'} as $v) {
        $vStr = sprintf("%s",$v->attributes()->{'Var'});
        // don't allow direction (degrees) for now
        if (sprintf("%s",$v->attributes()->{'Unit'}) != 'Degrees') {
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
  }
  else if ($xml && $xml->{'FeatureInfo'}) {
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
          array_push($data['d'][$vStr],sprintf("%f",$p->{'value'}[0]));
        }
      }
    }
  }
  else {
    $csv = csv_to_array($rawData);
    for ($i = 0; $i < count($csv); $i++) {
      preg_match("/(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)Z/",$csv[$i]['time'],$a);
      $t = mktime($a[4],$a[5],$a[6],$a[2],$a[3],$a[1]);
      if ($mapTime == $t) {
        $data['nowIdx'] = count($data['t']);
      }
      array_push($data['t'],$t * 1000);
      foreach (array_keys($csv[$i]) as $vStr) {
        if (preg_match('/'.$_REQUEST['varName'].'/i',$vStr)) {
          preg_match("/(.*)\[(.*)\]/",$vStr,$a);
          if (!array_key_exists($a[1],$data['d'])) {
            $data['d'][$a[1]] = array(sprintf("%f",$csv[$i][$vStr]));
            $data['u'][$a[1]] = $a[0];
          }
          else {
            array_push($data['d'][$a[1]],sprintf("%f",$csv[$i][$vStr]));
          }
        }
      }
    }

    // Assume that if the varName request has a comma in it, it is made up of u,v.
    // Go back through the collected data to come up w/ speed & dir, but pass it back
    // as speed,dir in under original varName.  It's the client's job to figure out what
    // to do w/ that.
    $voi = explode(',',$_REQUEST['varName']);
    if (count($voi) == 2) {
      if (array_key_exists($voi[0],$data['d']) && array_key_exists($voi[1],$data['d'])) {
        for ($i = 0; $i < count($data['d'][$voi[0]]); $i++) {
          if ($i == 0) {
            $data['d'][$_REQUEST['varName']] = array();
          }
          $u = $data['d'][$voi[0]][$i];
          $v = $data['d'][$voi[1]][$i];
          $spd = sqrt(pow($u,2) + pow($v,2));
          $dir = 90 - rad2deg(atan2($v,$u));
          $dir += $dir < 0 ? 360 : 0;
          array_push($data['d'][$_REQUEST['varName']],sprintf("%f,%d",$spd,$dir));
        }
        $data['u'][$_REQUEST['varName']] = $data['u'][$voi[0]];
        unset($data['u'][$voi[0]]);
        unset($data['u'][$voi[1]]);
        unset($data['d'][$voi[0]]);
        unset($data['d'][$voi[1]]);
      }
    }
  }

  $data['gfi'] = $gfiUrl;
  echo json_encode($data);

  // from http://www.php.net/manual/en/function.str-getcsv.php#100579
  if (!function_exists('str_getcsv')) {
    function str_getcsv($input, $delimiter=',', $enclosure='"', $escape=null, $eol=null) {
      $temp=fopen("php://memory", "rw");
      fwrite($temp, $input);
      fseek($temp, 0);
      $r = array();
      while (($data = fgetcsv($temp, 4096, $delimiter, $enclosure)) !== false) {
        $r[] = $data;
      }
      fclose($temp);
      return $r;
    }
  } 

  // from http://www.php.net/manual/en/function.str-getcsv.php#104558
  function csv_to_array($input,$delimiter=',') {
    $header  = null;
    $data    = array();
    $csvData = str_getcsv($input,"\n");
    foreach ($csvData as $csvLine) {
      if (is_null($header)) {
        $header = explode($delimiter, $csvLine);
      }
      else {
        $items = explode($delimiter, $csvLine);
        for ($n = 0,$m = count($header); $n < $m; $n++) {
          $prepareData[$header[$n]] = $items[$n];
        }
        $data[] = $prepareData;
      }
    }
    return $data;
  }
?>
