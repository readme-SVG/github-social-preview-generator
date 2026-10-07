from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

HOST = '127.0.0.1'
PORT = 8000
ROOT_DIR = Path(__file__).resolve().parent


class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


def run() -> None:
    parser = argparse.ArgumentParser(description='Serve RepoCard Studio locally.')
    parser.add_argument('--port', type=int, default=PORT)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    try:
        server = ThreadingHTTPServer((HOST, args.port), AppRequestHandler)
    except OSError as error:
        parser.exit(1, f'Could not start the server: {error}. Try --port 8001.\n')
    print(f'Serving RepoCard Studio at http://{HOST}:{args.port}')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    run()
