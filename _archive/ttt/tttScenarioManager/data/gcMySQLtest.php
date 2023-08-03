<?php

$hostname="34.106.46.2";
$username="root";
$password="tdms4All!";
$dbname="billtest";

error_reporting(E_ALL);

//Connect To Database
//include("dbConnVars.php");
//include("jsVariables.php");


//$seg_id       = $_GET["$sFNSegID_TABLE"];
//$collect_date = $_GET["$sFNSpdCrvCD"];
//$speed_max    = $_GET["speed_max"];
//$speed_bin     = $_GET["$sFNSpdCrvBN"];

$usertable    = "pa_board_alight_test";
//$sql_where    = "$sFNSegID_TABLE = $seg_id AND $sFNSpdCrvCD = $collect_date AND $sFNSpdCrvBN <= $speed_max ORDER BY SPEED_BIN";
//$sql_where    = $seg_id = $seg_id AND $collect_date = $collect_date AND SPEED_BIN <= $speed_max ORDER BY SPEED_BIN"

//turn on error display
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
//error_reporting(E_ALL);
    
//Connect To Database
//include("dbConnVars.php");

$dbh = new PDO("mysql:host=$hostname;dbname=$dbname", $username, $password);

//$sql =  "SELECT * FROM $usertable WHERE $sql_where";

$sql =  "SELECT A, D_BRT FROM $usertable";

foreach ($dbh->query($sql) as $row) {
    $A = $row["A"];
    $D_BRD = $row["D_BRT"];
    $return_arr[] = array("A" => $A, "D_BRD" => $D_BRD);
            //$return_arr[] = array("$sFNVolCrvDR" => $direction, "$sFNVolCrvSH" => $interval_start_hour, "$sFNVolCrvSM" => $interval_start_minute, "$sFNVolCrvFR" => $hourlyvolume);
}

// Encoding array in JSON format
echo json_encode($return_arr);


?>
