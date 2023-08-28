import http.server
import webbrowser
import threading

# Start the server in a separate thread
def start_server():
    server_address = ("", 8000)
    httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
    httpd.serve_forever()

# Open the browser after the server has started
def open_browser():
    webbrowser.open("http://localhost:8000")

# Start the server and open the browser concurrently
threading.Thread(target=start_server).start()
threading.Thread(target=open_browser).start()