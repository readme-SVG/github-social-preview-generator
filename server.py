from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import logging

# Configure logging for production-ready visibility
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

HOST = '0.0.0.0'
PORT = 8000
ROOT_DIR = Path(__file__).resolve().parent


class AppRequestHandler(SimpleHTTPRequestHandler):
    """
    Custom request handler for RepoCard Studio.
    Enforces security headers and serves files from the project root.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self):
        # Security headers: prevent caching, sniffing, and cross-origin framing
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:")
        super().end_headers()

    def log_message(self, format, *args):
        # Override default logging to use standard logger
        logger.info(f"{self.address_string()} - {format % args}")


def run() -> None:
    """
    Initializes and starts the ThreadingHTTPServer.
    Supports custom port configuration via CLI arguments.
    """
    parser = argparse.ArgumentParser(description='Serve RepoCard Studio locally.')
    parser.add_argument('--port', type=int, default=PORT, help='Port to bind the server (default: 8000)')
    args = parser.parse_args()

    if not 1 <= args.port <= 65535:
        parser.error('Port must be between 1 and 65535')

    try:
        # Bind to 0.0.0.0 to allow external connections (required for container/preview environments)
        server = ThreadingHTTPServer((HOST, args.port), AppRequestHandler)
        logger.info(f'Serving RepoCard Studio at http://{HOST}:{args.port}')
    except OSError as error:
        parser.exit(1, f'Could not start the server: {error}. Try --port {args.port + 1}.\n')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info('Server interrupted by user. Shutting down gracefully.')
    except Exception as e:
        logger.error(f'Server encountered an unexpected error: {e}')
    finally:
        server.server_close()
        logger.info('Server closed.')


if __name__ == '__main__':
    run()
