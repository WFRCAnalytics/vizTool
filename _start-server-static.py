import http.server
import webbrowser
import threading
import traceback
import os

# Ensure correct directory
base_directory = os.path.join(os.getcwd(), r"Scenarios\\.vizTool\\")
os.chdir(base_directory)

# Function to open the site in the default browser
def open_browser():
    url = "http://localhost:8080/index.html"
    webbrowser.open(url)

# Start the server in a separate thread
def start_server():
    try:
        server_address = ("", 8080)
        httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
        print("Starting server on port 8080...")
        httpd.serve_forever()
    except Exception as e:
        print("Error starting the server:")
        traceback.print_exc()

# Start the server and open the browser concurrently
server_thread = threading.Thread(target=start_server)
server_thread.start()

# Wait a moment for the server to start
import time
time.sleep(2)

# Open the browser
browser_thread = threading.Thread(target=open_browser)
browser_thread.start()

# Wait for threads to finish (optional, depends on your use case)
server_thread.join()
browser_thread.join()
