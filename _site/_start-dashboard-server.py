import http.server
import webbrowser
import threading
import traceback

# Start the server in a separate thread
def start_server():
    try:
        server_address = ("", 8000)
        httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
        httpd.serve_forever()
    except Exception as e:
        print("Error starting the server:")
        traceback.print_exc()

# Open the browser after the server has started
def open_browser():
    webbrowser.open("http://localhost:8000/dashboard-index.html")

# Start the server and open the browser concurrently
threading.Thread(target=start_server).start()
threading.Thread(target=open_browser).start()