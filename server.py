import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.web
import tornado.websocket
import simplejson as json
import time, os, hashlib, random, hmac
import collectd
from tornado import iostream
from pprint import pprint

from tornado.options import define, options

define("port", default=8888, help="run on the given port", type=int)


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.write("Hello, world")

class EchoWebSocket(tornado.websocket.WebSocketHandler):
    def on_message(self, message):
       self.write_message(u"You said: " + message)


class SourceSet(object):
    def __init__(self):
        self.subscribers = dict()

    def subscribe(self, source, subscriber):
        if (not self.subscribers.has_key(source)):
            self.subscribers[source] = set([])
        self.subscribers[source].add(subscriber)
    
    def send(self, source, ts, interval, values):
        for subscriber in self.subscribers.get(source,[]):
            subscriber.msg(type="p7.s", source=source, values=values, time=ts, expected=ts+interval)

active_clients = []
sources = SourceSet()

class P7WebSocket(tornado.websocket.WebSocketHandler):
    def msg(self, **kwargs):
        try:
            self.write_message(kwargs)
        except IOError, e:
            pass
    
    def open(self):
        """ When a websocket is opened, we need to send welcome """
        self.challenge = hashlib.sha256(str(random.getrandbits(256))).hexdigest() # Sufficiently random challenge. Probably.
        self.msg(type="p7.welcome",version=1,challenge=self.challenge)
        self.state = 'new'
    
    def on_close(self):
        global active_clients
        active_clients.remove(self)

    def on_message(self, message):
        global active_clients, sources
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
            match = hmac.new(self.challenge, 'guest', hashlib.sha256).hexdigest()
            if message['password'] != match:
                self.msg(type='py.error.auth_failed',message='Invalid username or password')
                return
            
            self.state = 'authenticated'
            self.version = message['version']
            self.username = message['username']
            # Send the current configuration
            # Currently a fake config defining one layer, containing one node
            # which supplies a CPU source on source.raven.cpu
            self.msg(type='p7.configure',config={
                'world': {
                    'server_template': {
                        'type': 'Template',
                        'radius': 20,
                        'charts': {
                            'mem_active': {
                                'type': 'ArcBar',
                                'value_unit': 'bytes',
                                'value_limit': 256*1024*1024,
                                'label': 'mem/used',
                                'radius': 24,
                                'angle': -90,
                                'arc': 180,
                                'width': 20,
                                'source': 'memory/memory/used'
                            },
                            'disk_used': {
                                'type': 'ArcBar',
                                'value_unit': 'bytes',
                                'value_limit': 9.4*1024*1024*1024,
                                'label': 'disk/root',
                                'radius': 48,
                                'angle': -90,
                                'arc': 180,
                                'width': 20,
                                'source': 'df/df/root'
                            },
                            'load': {
                                'type': 'ArcBar',
                                'value_unit': '',
                                'value_limit': 5,
                                'label': 'load',
                                'radius': 24,
                                'angle': 92,
                                'arc': 176,
                                'width': 44,
                                'source': 'load/load',
                                'alarm': 1.0,
                            },
                            'cpu0': {
                                'type': 'ArcBar',
                                'value_unit': '',
                                'value_limit': 100,
                                'label': 'cpu0',
                                'radius': 72,
                                'angle': -90,
                                'arc': 60,
                                'width': 5,
                                'source': 'cpu/0/cpu/user'
                            },
                            'cpu1': {
                                'type': 'ArcBar',
                                'value_unit': '',
                                'value_limit': 100,
                                'label': 'cpu1',
                                'radius': 79,
                                'angle': -90,
                                'arc': 60,
                                'width': 5,
                                'source': 'cpu/1/cpu/user'
                            },
                            'cpu2': {
                                'type': 'ArcBar',
                                'value_unit': '',
                                'value_limit': 100,
                                'label': 'cpu2',
                                'radius': 86,
                                'angle': -90,
                                'arc': 60,
                                'width': 5,
                                'source': 'cpu/2/cpu/user'
                            },
                            'cpu3': {
                                'type': 'ArcBar',
                                'value_unit': '',
                                'value_limit': 100,
                                'label': 'cpu3',
                                'radius': 93,
                                'angle': -90,
                                'arc': 60,
                                'width': 5,
                                'source': 'cpu/3/cpu/user'
                            },
                        }
                    },
                    'mail': {
                        'type': 'Router',
                        'label': 'mail',
                        'template': 'server_template',
                        'source_prefix': 'mail/',
                        'x': 340,
                        'y': 120,
                    },
                    'monitor1': {
                        'type': 'Router',
                        'template': 'server_template',
                        'source_prefix': '',
                        'label': 'monitor1',
                        'x': 140,
                        'y': 120,
                    }
                }
            })
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
            sources.subscribe(message['source'], self)
            self.msg(type="p7.subscribed", source=message['source'], message="Subscribed to %s successfully" % message['source'])
        
        if message['type'] == 'p7.request':
            print message
            # Request an analysis set
            if sources.has_key(message['source']):
                self.msg(type="p7.in_progress", key=message['key'], message="Data request in progress")
                sources[message['source']].prepare(self, message['key'], message['start'], message['end'], message['step'])
                return
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

def fake_sources():
    global sources
    
    sources.send('fake/random_percent',time.time(), 1, [random.randint(0,100)])
            
    tornado.ioloop.IOLoop.instance().add_timeout(time.time()+1, fake_sources)
    
    
def on_collect(fd, events):
    global sources
    
    iterable = collector.interpret()
    for m in iterable:
        #pprint((m.source,list(m)))
        
        sources.send(m.source, m.time, m.interval, list(m))

collector = None
collector_stream = None

def main():
    global sources, collector, collector_stream
    tornado.options.parse_command_line()
    application = tornado.web.Application([
        (r"/", MainHandler),
        (r"/echo",EchoWebSocket),
        (r"/p7",P7WebSocket)
    ], static_path=os.path.join(os.path.dirname(__file__), "client"))
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(options.port)
    
    
    # Start the time signal
    time_signal()
    # Start the fake source providers
    fake_sources()
    
    ioloop = tornado.ioloop.IOLoop.instance()
    
    # Set up collector
    collector = collectd.Reader(host="67.23.45.129")
    collector._sock.setblocking(0)
    ioloop.add_handler(collector._sock.fileno(), on_collect, ioloop.READ)

    ioloop.start()

if __name__ == "__main__":
    main()

