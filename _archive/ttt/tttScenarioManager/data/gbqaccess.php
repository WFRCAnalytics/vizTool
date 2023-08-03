<?php
//require 'vendor/autoload.php';

use Google\Cloud\BigQuery\BigQueryClient;

$bigQuery = new BigQueryClient([
    type => "service_account",
    project_id => "tdm-scenarios",
    private_key_id => "7d0a8fcfeea6ab8c3e96852250c4ebb3a244d90f",
    private_key => "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDoC/7cmqar8Y3Y\nwkIOJjQjT/pZdqGrF1GHpdfH00toqDrKZIpXhQ9TmsriH4nl6dsKpErOsiWzXIz1\n4DeSnxJ3EfjxL7ZEM9M3qrSu+nW/p7Z1u9RYSRGkfZtWSaf7vTbTdP2bRREJk2Nf\nO2c3nMuSGMXebpYnZarTdNWfGkaZEYAosXM7X+KqX1wpLRVlOG5FclpKPrk+B2NB\nljqLpCzZKZsTmfHjS+R32ixxJj+bldj80VIZVlgEpauKYrJjHudaR/E5YXqgGp7S\ntqsYpYZgPlDLkI3qMF1J0e7uSt+XekivW+sc3GJqb1B8iSmzo+2iIcOWjzFsIoDR\nvuho7lHjAgMBAAECgf8/5w3Iss4zi9IEX3rRarPxBZVsDb933nQVZxaFcSrTJ4EJ\nO6bdc0dFPtugag8PwdcQly4Cvgyj2Fj5XUXwmt367Hgh84G+RodkTR51EYRbw1P8\nGD3iEj1Jj0239ZDNQs5WbWFp4RtQB8bV8wX5yrRFB412M/4l21mv4fzyU8odXK4L\npq9bUMQ0OzFEHc+mUlfyb2hKrxgDThQGJ3CFOJ7Tb+7VPN2RbHh0eEHEqI47bJpS\ntqcUzfN4KLazFJJzXn8Rya8/0NO05b3RDtVlZuLZKZLruT6PTPzQiZTZaV2Ump4c\nWHfqmF3JGaJOpnku/11EGMIBvYaX2ddO30C0YKUCgYEA/0+LDYFLFP0512O/ltsX\nf7wIlgOccbx77Fd32xVz20bG0HuccyG7sHYo9dZ0Bq4wch39sTwQYUhwoThuH9ou\ncU+tz38ch7FjUtWvkkXDtNhwhNTrQVvR7CJXt/HJpEPAkEoqhcw7x3LzpciGlVsz\nbeXLJGiNYTrRRFL9yV82L60CgYEA6KxfqOA1CYU2PCgqCV/jOdEGb+8nO+XFO57V\n4Y01QQ90AeVw+RtLEfNiX3/FBKwbj7sufxz5l1RRbOBR/1vDQ21tooArQOwV5YmO\nuMOAkRNt2i+qJWZDCT79UND0pnn2uz8y7IiuGn31mrL6TFMZLROg+ZWAyYjp/F8d\nfvyJec8CgYEA5mTcogpMPBusB9AvA66gzRddVCrcEdM6rXPdaCo6y+VZ4qe57jfB\nzSNEIV0uhRzKASFJX5hJW9DoOsTWtA3LHVv/CKG3mEgezpChCMnGKzuqhmQyDGAU\n1xfCuu8JvR+a9VrIdsdwJrN4ZeHIeZ28km7tW+SxuM1ALX0LIp62Il0CgYEA4i4O\nn7+0Txjr6/avRoWsAZwsQcudvCBUZuy0xZnbVu+Kuf0soTvi8gRCcMtn3m7gLAyt\n2mt0RaN1s/0sOKwfWQCbPwiRA398mbHqx7lk1aKpexwyrkCGkgplfZZi/SI6szNw\ncXc8qAwiIMwzfNaa9rLKHVUz6LXrn6VmqvcbPQkCgYEA5KEocPzMCq/+oKcCkA5U\nxPP0Ve/wQkpSRK05xSSkHaCcQxmPPMn+2KtjkLic7Wxol06I2N3VpfoSGOKHryHk\nkxpSR5WjQSQ+FXFaSpRXzlXgtIalxagVnW/6fZ3Z6DeF8++q1+6oZx//7VYi1WDz\n+8Yc87WPGkPyi2Y+wuAO/yo=\n-----END PRIVATE KEY-----\n",
    client_email => "webphp@tdm-scenarios.iam.gserviceaccount.com",
    client_id => "111293634557611935405",
    auth_uri => "https://accounts.google.com/o/oauth2/auth",
    token_uri => "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url => "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url => "https://www.googleapis.com/robot/v1/metadata/x509/webphp%40tdm-scenarios.iam.gserviceaccount.com"
]);

// Get an instance of a previously created table.
$dataset = $bigQuery->dataset('tdm-scenarios.tdm_scenarios_output');
$table = $dataset->table('scenarios');

// Begin a job to import data from a CSV file into the table.
//$loadJobConfig = $table->load(
//    fopen('/data/my_data.csv', 'r')
//);
//$job = $table->runJob($loadJobConfig);

// Run a query and inspect the results.
$queryJobConfig = $bigQuery->query(
    'SELECT * FROM `' + $dataset + '.' +$table + '`'
);
$queryResults = $bigQuery->runQuery($queryJobConfig);

foreach ($queryResults as $row) {
    print_r($row);
}

?>