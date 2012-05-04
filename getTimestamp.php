<?php
  date_default_timezone_set('UTC');
  $u = substr($_SERVER["REQUEST_URI"],strpos($_SERVER["REQUEST_URI"],'?')+1);
  $c = get_headers(urldecode($u));

  for ($i = 0; $i < count($c); $i++) {
    if (preg_match('/Warning: (99 Nearest value used: time=)*([^ ]*)/i',$c[$i],$match)) {
      $d = $match[2];
      if ($d == 'invalidBbox') {
        echo 'invalidBbox';
      }
      else if ($d == 'DateNotAvailable') {
        echo 'dateNotAvailable';
      }
      else {
        if (substr($d,strlen($d)-1,1) != 'Z') {
          $d .= 'Z';
        }
        echo strtotime($d);
      }
    }
  }
?>
