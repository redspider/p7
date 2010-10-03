import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.web
import tornado.websocket
import simplejson as json
import time, os, hashlib, random, hmac

from tornado.options import define, options

define("port", default=8888, help="run on the given port", type=int)


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.write("Hello, world")

class EchoWebSocket(tornado.websocket.WebSocketHandler):
    def on_message(self, message):
       self.write_message(u"You said: " + message)

"""
P7 requires that you subscribe to the things you're interested in, except for
the initial configuration message
"""

active_clients = []

class P7WebSocket(tornado.websocket.WebSocketHandler):
    def msg(self, **kwargs):
        self.write_message(kwargs)
    
    def open(self):
        """ When a websocket is opened, we need to send welcome """
        self.challenge = hashlib.sha256(random.randbits(256)).hexdigest() # Sufficiently random challenge. Probably.
        self.msg(type="p7.welcome",version=1,challenge=self.challenge)
        self.state = 'new'
    
    def on_close(self):
        global active_clients
        active_clients.remove(self)

    def on_message(self, message):
        global active_clients
        # Subscription message?
        message = json.loads(message)
        if message['type'] == 'p7.authenticate':
            # Password is always "guest" at the moment. The challenge prevents
            # the password from being sent in the clear while avoiding any
            # replay issues
            #
            # The only issue is that in this sense, it requires the password to be
            # known to the server in plaintext. It seems practical with current
            # technology to generate a bcrypt'd version at the javascript end
            # instead. Ignoring for now, more important things to do
            match = hmac.new(self.challenge, 'guest').hexdigest()
            if message['password'] != match:
                self.msg(type='py.error.auth_failed',message='Invalid username or password')
                return
            
            self.state = 'authenticated'
            self.version = message['version']
            self.username = message['username']
            # Send the current configuration
            self.msg(type='p7.configure',config={})
            # Register client for time signaling
            active_clients.append(self)
            return
        
        # If they're new they have to auth first
        if self.state == 'new':
            self.msg(type="p7.error.must_authenticate",message="Client must authenticate before requesting data")
            # Probably want to force-close the socket here
            return
        
        if message['type'] == 'p7.ping':
            self.msg(type="p7.pong")
            return
        
        if message['type'] == 'p7.subscribe':
            # If they've got a valid target, sub this client
            # Otherwise, error
            self.msg(type="p7.error.invalid_source", message="Invalid message source")
            return
        
        # If we didn't recognise the message time, send an error.
        self.msg(type="p7.error.invalid_message_type", message="Invalid message type")

def time_signal():
    global active_clients
    for ws in active_clients:
        ws.msg(type="p7.time",time=time.time())
    print "Sending time signal"
    tornado.ioloop.IOLoop.instance().add_timeout(time.time()+1, time_signal)

def main():
    tornado.options.parse_command_line()
    application = tornado.web.Application([
        (r"/", MainHandler),
        (r"/echo",EchoWebSocket),
        (r"/p7",P7WebSocket)
    ], static_path=os.path.join(os.path.dirname(__file__), "client"))
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(options.port)
    tornado.ioloop.IOLoop.instance().add_timeout(time.time()+1, time_signal)
    tornado.ioloop.IOLoop.instance().start()


if __name__ == "__main__":
    main()

