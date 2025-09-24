import http.server
import webbrowser
import threading
import traceback
import subprocess

# Function to open Chrome in incognito mode and open the site
def open_chrome_incognito(url):
    subprocess.Popen(["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "--incognito", url])

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
    open_chrome_incognito(url)

# Start the server and open the browser concurrently
threading.Thread(target=start_server).start()
threading.Thread(target=open_browser).start()