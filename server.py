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

"""

Todo:

Fix quartile calculations for low-sample
Get wstest.html working
Figure out a way to do ws to localhost so I don't have to keep fucking with raven. Oh, easy, specify local ethernet IP instead of localhost
"""

def five_sum(values):
    """ Takes a set of numeric values and builds a five number summary
        (min, 25th, 50th, 75th, max). Doesn't provide the mean. Do we need the mean?
    """
    values.sort()
    size = len(values)
    
    # Not sure these are terribly accurate for the quartiles under low-sample conditions
    return (values[0], values[size/4], values[size/2], values[-(size/4)], values[-1])

class Source(object):
    """ A data source """
    def __init__(self, id, type, value_count, measure):
        self.id = id
        self.type = type
        self.subscribers = set([])
        self.history = []
        self.last = []
        self.last_count = 10
        self.value_count = value_count
        
        self.measure = measure # bps, bytesps, percentage
    
    def receive(self, values):
        """ New value received. ... not sure what to do with it yet """
        ts = time.time()
        # I guess we need to send it to subscribers. Format?
        # TODO: calculate messages-per-second for use in smoothing client-side
        self.last.append(ts)
        if len(self.last) > self.last_count:
            self.last.pop(0)
        
        if (ts <= self.last[0]):
            # In this case we can't guess, so we'll stick with 1
            spm = 1
        else:
            # Normally be 10/10 for 1 second per message, but a 5 min update
            # would be 3600/10 = 360s per message = 5 min per message
            spm = (ts-self.last[0]) / len(self.last)
        
        # Send to subscribers
        for subscriber in self.subscribers:
            # Expected is the time the next message is expected, calculated from
            # the existing time + seconds per message
            subscriber.msg(type="p7.s.%s" % id, values=values, time=ts, expected=ts+spm)
        # We also need to store it with a timestamp
        self.history.append((ts, values))
    
    def prepare(self, subscriber, key, start, end, step):
        """ Prepare an analysis section """
        """ Analysis request involves a key given by the client, this is opaque and will be returned with the request for id'ing the response
        the start and end are server times, in seconds, bounding the response. It is recommended these times be a proper multiple of step
        step is the number of seconds per response set.
        """
        """
        The result contains a value set that looks like this:
        
        value_set = [
            [time, [[0,25,50,75,100],[0,10,20,30,100]]],
            [time, [[0,25,50,75,100],[0,10,20,30,100]]],
            ...
        ]
        
        The five values are: min, 25th percentile, 50th, 75th, and max
        for the sample space for that step. This allows proper display of the
        data. It's plausible we want this to be 7-number (5%/95%) instead, or
        maybe an option.
        
        """
        
        # The following is a trivial hack to do the analysis in the server
        # in practice we want to make the backend do as much of this work
        # as possible, whatever that backend ends up being.
        result = []
        for m in self.history:
            # Might need to put in a value at either end
            if m[0] > start and m[0] < end:
                result.append(m)
        
        final = []
        for t in xrange(start, end, step):
            total = [[]] * self.value_count
            while len(result):
                # Get the time and values out of the result
                (rt, rv) = result.pop(0)
                # If the time is out of range, break out of this step
                if rt >= (t+step):
                    break
                
                # For each value in rv
                for i,v in enumerate(rv):
                    # Add to the set
                    total[i].append(v)
            # Generate 5-sums for each of the values arrays
            for i,v in enumerate(total):
                total[i] = five_sum(v)
            # Append item like this:
            # (time, [[0,25,50,75,100],[0,25,30,40,60],...])
            final.append((t, total))
    
        # Send message to subscriber detailing result
        subscriber.msg(type="p7.r.%s" % self.id, key=key, start=start, end=end, step=start, value_set=final)
        
    def subscribe(self, subscriber):
        """ New subscriber, add to sub set """
        self.subscribers.add(subscriber)
        

active_clients = []
sources = dict()

class P7WebSocket(tornado.websocket.WebSocketHandler):
    def msg(self, **kwargs):
        self.write_message(kwargs)
    
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
                'nodes': {
                    'raven': {
                        'label': 'raven',
                        'long_label': 'raven.redspider.co.nz',
                        'x': 120,
                        'y': 120,
                        'radius': 50
                    }
                },
                'layers': {
                    'physical': {
                        'label': 'Physical',
                        'nodes': {
                            'raven': {
                                'sources': {
                                    'cpu': {'type': 'random_percent', 'radius': 100, 'angle': 32, 'arc': 26}
                                }
                            }
                        },
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
            if sources.has_key(message['source']):
                sources[message['source']].subscribe(self)
                self.msg(type="p7.subscribed", source=message['source'], message="Subscribed to %s successfully" % message['source'])
                return
            # Otherwise, error
            self.msg(type="p7.error.invalid_source", message="Invalid message source")
            return
        
        if message['type'] == 'p7.request':
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
    
    for source in sources.values():
        if source.type == 'random_percent':
            source.receive([random.randint(0,100)])
            
    tornado.ioloop.IOLoop.instance().add_timeout(time.time()+1, fake_sources)
    
    

def main():
    global sources
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
    sources['raven.cpu'] = Source('raven.cpu', 'random_percent',1,'percentage')
    fake_sources()
    tornado.ioloop.IOLoop.instance().start()


if __name__ == "__main__":
    main()

