# ----------------------------------------------------------------------------------------
# import libraries
# ----------------------------------------------------------------------------------------
import http.server
import threading
import traceback
import os
import time
import importlib.machinery
import webbrowser


# ----------------------------------------------------------------------------------------
# specify parent and scenario directorys
# ----------------------------------------------------------------------------------------
# create path to global variables input file
in_GlobalVar_txt     = "_pp_GlobalVars.txt"
path_in_GlobalVar_txt = os.path.join(os.getcwd(), "7_PostProcessing", in_GlobalVar_txt)

# create variables from input file global variables
GlobalVars = importlib.machinery.SourceFileLoader('data', path_in_GlobalVar_txt).load_module()

# set python variable from global variables
UsedZones   = GlobalVars.UsedZones
ParentDir   = GlobalVars.ParentDir
ScenarioDir = GlobalVars.ScenarioDir


# ----------------------------------------------------------------------------------------
# define function to print request data
# ----------------------------------------------------------------------------------------
# Custom request handler to print detailed information about requests
class VerboseHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        print(f"Handling GET request for {self.path}")
        super().do_GET()


# ----------------------------------------------------------------------------------------
# define functions to start the server and open the browser
# ----------------------------------------------------------------------------------------
# Start the server in a separate thread
def start_server():
    try:
        # Set the directory containing your HTML files
        base_directory = os.path.join(ParentDir, r"Scenarios\\.vizTool\\")
        os.chdir(base_directory)
        print(os.getcwd)
        
        server_address = ("", 8080)
        httpd = http.server.HTTPServer(server_address, VerboseHTTPRequestHandler)
        print("Starting server on port 8080...")
        httpd.serve_forever()
    except Exception as e:
        print("Error starting the server:")
        traceback.print_exc()

# Open in incognito mode after the server has started
def open_browser():
    url = "http://localhost:8080/index.html"
    webbrowser.open(url)


# ----------------------------------------------------------------------------------------
# run functions to start the server and open the browser
# ----------------------------------------------------------------------------------------
# Start the server and open the browser concurrently
server_thread = threading.Thread(target=start_server)
server_thread.start()

# Wait a moment for the server to start
time.sleep(2)

# Open the browser
browser_thread = threading.Thread(target=open_browser)
browser_thread.start()

# Wait for threads to finish
server_thread.join()
browser_thread.join()
