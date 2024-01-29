# Author: Bill Hereth & Chris Day
# Date Edited:        01/23/2024
#
# 
# Description: This script opens a local host of the viztool

print("\nStarting VizTool") 

#====================================
# Initial Setup
#====================================
#import libraries
import http.server
import threading
import traceback
import subprocess
import psutil
import os, sys

# Set file paths
Root_dir = os.path.dirname(sys.argv[0])
print("Root directory: \n    " + Root_dir)

# if statement to allow both voyager and .bat script to open viztool
if os.path.exists(Root_dir):
    os.chdir(Root_dir)

else:
    os.chdir(os.getcwd())
    print(os.getcwd())

log = os.path.join(os.getcwd(),"LogFile_LocalHost.txt")
logFile = open(log, 'w')
logFile.write(("Starting VizTool: \n"))
logFile.write(("Root directory: " + os.getcwd() + "\n"))


# Function to find chrome extention
def find_chrome_processes():
    for process in psutil.process_iter(['pid', 'name', 'exe']):
        if process.info['name'] == 'chrome.exe':
            return process.info['exe']


# Function to open Chrome in incognito mode and open the site
def open_chrome_incognito(chrome_path, url):
    subprocess.Popen([chrome_path, "--incognito", url])

# Start the server in a separate thread
def start_server():
    try:
        server_address = ("", 8000)
        httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
        httpd.serve_forever()
    except Exception as e:
        print("Error starting the server:")
        traceback.print_exc()

# Open Chrome in incognito mode and the server has started
def open_browser():
    url = "http://localhost:8000/index.html"
    chrome_paths = find_chrome_processes()
    open_chrome_incognito(chrome_paths, url)


#====================================
# Start server and open local host in chrome
#====================================
def Main():
    try:
        logFile.write("Opening local host...\n")
        # Start the server and open the browser concurrently
        threading.Thread(target=start_server).start()
        threading.Thread(target=open_browser).start()
        logFile.write("\n\n**Note: closing the command prompt may result in a Cube python warning message**")
    except:
        print("*** There was an error running this script - Check output logfile.")
        tb = sys.exc_info()[2]
        tbinfo = traceback.format_tb(tb)[0]
        pymsg = "\nPYTHON ERRORS:\nTraceback info:\n"+tbinfo+"\nError Info:\n"+str(sys.exc_info())
        logFile.write(""+pymsg+"\n")
        raise
    finally:
        logFile.close()

Main()



