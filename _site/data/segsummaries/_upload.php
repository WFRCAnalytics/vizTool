<style>  
   body {
     font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
   }
</style>
<?php

include '_config_uploadkey.php';

//upload key
$username       = $_POST['username'    ];
$uploadkeyinput = $_POST['uploadkey'   ];
$scenarioname   = $_POST['scenarioname'];

//$destDir = $_POST['dir'];
//$target_dir = "/home/wfrcorg/public_html/ttt/widgets/tttScenarioManager/segsummaries/";
$target_dir = "segsummaries/";
$target_file = $target_dir . basename($_FILES["fileToUpload"]["name"]);
$uploadOk = 1;
$imageFileType = strtolower(pathinfo($target_file,PATHINFO_EXTENSION));

// Check if correct upload key
if($uploadkeyinput==$uploadkeyactual) {
    
    // Check if file already exists
    if (file_exists($target_file)) {
        echo "Sorry, file already exists.<br/><br/>";
        echo "<a href='_uploadform.html'>Try again.</a>";
        $uploadOk = 0;
    }
    
    // Check file size
    if ($_FILES["fileToUpload"]["size"] > 5000000) {
        echo "Sorry, your file is too large.<br/><br/>";
        echo "<a href='_uploadform.html'>Try again.</a>";
        $uploadOk = 0;
    }
    
    // Allow certain file formats
    if($imageFileType != "csv" ) {
        echo "Sorry, only CSV files are allowed<br/><br/>";
        echo "<a href='_uploadform.html'>Try again.</a>";
        $uploadOk = 0;
    }
    
    // Check if $uploadOk is set to 0 by an error
    if ($uploadOk == 0) {
        echo "Sorry, your file was not uploaded.";
    // if everything is ok, try to upload file
    } else {
        
        // read in JSON with field name configs

        // Get the contents of the JSON file 
        $strJsonFileContents = file_get_contents("_config_segsummary_fieldname_conversion.json");

        // Convert to array 
        $arrayCSVtoJSONFields = json_decode($strJsonFileContents, true);

        // create array of seg summary import column names
        $colnamesforimport = array_keys($arrayCSVtoJSONFields);

        // create array of seg summary export column names
        $colnamesforexport = array();
        foreach ($colnamesforimport as &$value) {
            array_push($colnamesforexport,$arrayCSVtoJSONFields[$value]);
        }

        // parse csv data
        $csv = array();
        $i = 0;
        if (($handle = fopen($_FILES["fileToUpload"]["tmp_name"], "r")) !== false) {
            $columns = fgetcsv($handle, 1000, ",");

            // parse csv into array
            while (($row = fgetcsv($handle, 1000, ",")) !== false) {
                $csv[$i] = array_combine($columns, $row);
                $i++;
            }
            fclose($handle);

            // delete elements from array not in import names
            foreach ($columns as &$colname) {
                if (!in_array($colname, $colnamesforimport)) {
                    foreach ($csv as $key => $subArr) {
                        unset($subArr[$colname]);
                        $csv[$key] = $subArr;  
                    }
                }
            }
        }

        // trim all spaces out of csv data
        array_walk_recursive($csv,function(&$v){$v=ltrim($v);});
        
        //print_r($csv[2]);

        // change all the field names
        function changeKeys($array, $keyEnArray, $keyZhCnArray)
        {
            if(!is_array($array)) return $array;
            $tempArray = array();
            foreach ($array as $key => $value){
                // Processing keys for arrays, translated into Chinese
                $key = array_search($key, $keyEnArray, true) === false ? $key : $keyZhCnArray[array_search($key, $keyEnArray)];
                if(is_array($value)){
                    $value = changeKeys($value, $keyEnArray, $keyZhCnArray);
                }
                $tempArray[$key] = $value;
            }
            return $tempArray;
        }
        $csvrenamedkeys = changeKeys($csv, $colnamesforimport, $colnamesforexport);
        //print_r($csvrenamedkeys[2]);

        // generate a unique id for use in field name
        $id = uniqid(rand(), true);
        $filename =  $id.'.json';

        // write file as json
        $json = json_encode($csvrenamedkeys);

        // manually make indexed by SEGID
        // SEGID must be field A and must be followed by field B
        $json1 = str_replace('"'   ,''     ,$json );
        $json2 = str_replace(',{A:',',"'   ,$json1);
        $json3 = str_replace(',B:' ,'":{B:',$json2);
        $json4 = str_replace(']'   ,'}'    ,$json3);
        $json5 = str_replace('[{A:' ,'{"'  ,$json4);
        

        if(file_put_contents('ss_'.$filename, $json5)) {
            
            $scenario_info = ',{"value": "id_'.$id.'","label": "'.$scenarioname.'","username": "'.$username.'"}]';
            
            // Get the contents of the JSON file 
            define("BASEPATH", getcwd());
            $strScenariosFile = BASEPATH."/../scenarios.json";

            $strScenarioJSON = file_get_contents($strScenariosFile);
            $strScenarioJSON1 = str_replace(']',$scenario_info,$strScenarioJSON);

            if(file_put_contents($strScenariosFile,$strScenarioJSON1)) {
                echo "The file has been uploaded.<br/><br/>Please refresh scenario.<br/><br/>";
                echo "<a href='_uploadform.html'>Upload another scenario.</a>";
            }

        } else {
            echo "Sorry, there was an error uploading your file.";
        }
    }

} else {
    echo 'invalid upload key<br/><br/>';
    echo "<a href='_uploadform.html'>Try again</a>";
}


?>
