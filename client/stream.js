/*
 Data streams repreent one or more values over time, connected to a source
*/

/* A DataSet represents one contiguous set of messages from a data stream
  between start and end, at resolution step with aggregation method agg
  
  agg is one of MEAN, MEDIAN, MAX, MIN, COUNT..?
  
  Need to prevent blurring by unnecessary aggregation in low samples...redefine
  start/end to message boundaries and add a small number at either end?
  
  Or assign slots somehow so that it always makes sure a slot is filled or null
  if the message is missing
  
  
  Or possibly work it out based ont he time range and the number of samples
  required, instead of steps
  this way one that ends in "now" could continue to be supplied with new info,
  maybe (Think 5-minute average, scrolling)
  
  Maybe "live" should be a flag on a dataset , which adds a "projected next step"
  value to the end which contains a linear projection of the next value at the
  time of the last received message?
  
  aggregate sets should always be on particular boundaries, ie 5 minutes vs server time
  
  Possible that the dataset should include next-message-expected as a time, calculated
  via a rolling average. This would then be used for offset calculations by smooth charts
  
  
  aggregate sets only really work for numeric data. What about status data like errors? pings? - COUNT makes sense still
  
  
  Really need to create a fake Remote that generates a broad selection of messages accurately. Maybe even a real
  remote from the laptop?
  
  
  Ok, so websockets is looking good for it, tornado has websockets support and the whole thing looks
  pretty ideal for passing json-encoded objects back and forth as messages. Can use the IOLoop timeout method to trigger something that
  scans the CPU usage and pushes it out as a message, plus on_mesage etc to commucate with the server side to request history (stored in mongo)
  
  Lets get the server side working so that we can generate a realistic stream of messages etc before deciding on the final protocol structure
  
  
  
  
  
*/
var DataSet = Class.extend({
    init: function (start, end, step, agg, data) {
        this.start = start;
        this.end = end;
        this.step = step;
        this.agg = agg;
        this._data = data;
        this.requested = new Date().getTime();
        this.last_used = new Date().getTime();
    },
    
    data: function () {
        // Returns the data and updates the last_used for cache-clearing purposes
        this.last_used = new Date().getTime();
        return this._data;
    }
});

var DataStream = Class.extend({
    init: function () {
        this.template = [
            {label: 'cpu0', type: 'percentage', color: '#ff0'}
        ]
        // Not sure how to do the caching without running into mem probs
        // Possible could do retrievals as sets, and then give a contiguous
        // result by parsing.
        this.cache = [];
    },
    
    recent: function (seconds, step, agg) {
        // Returns the most recent n seconds of data at step and agg resolution
    },
    
    prepare: function (start, end, step, agg, callback) {
        // Retrieve data into the cache for this stream between the given times.
        // Times need to be specified in server time, magic values such as 'now'
        // are ok too?
        // Callback will be called when data is available, callback will receive
        // DataSet as arg
    },    
});