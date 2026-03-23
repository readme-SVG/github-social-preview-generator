from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = '127.0.0.1'
PORT = 8000
ROOT_DIR = Path(__file__).resolve().parent


class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)


def run() -> None:
    server = ThreadingHTTPServer((HOST, PORT), AppRequestHandler)
    print(f'Serving GitHub Social Preview Generator at http://{HOST}:{PORT}')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    run()
