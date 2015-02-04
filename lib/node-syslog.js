var net = require('net');
var os = require('os');
var dgram=require('dgram');
//
// node-syslog.js - TCP syslog-ng client
//

// Message severity levels
this.LOG_EMERG = 0;
this.LOG_ALERT = 1;
this.LOG_CRIT = 2;
this.LOG_ERROR = 3;
this.LOG_WARNING = 4;
this.LOG_NOTICE = 5;
this.LOG_INFO = 6;
this.LOG_DEBUG = 7;

this.FACILITY_USER = 1;

this.DEFAULT_OPTIONS = {
    facility: exports.FACILITY_USER,
    name: null,
    debug: false
};

var hostname = os.hostname();

this.Client = function (port, host, options) {
    this.port = port || 514;
    this.host = host || 'localhost';
    this.options = options || {};

    for (var k in exports.DEFAULT_OPTIONS) {
        if (this.options[k] === undefined) { this.options[k] = exports.DEFAULT_OPTIONS[k] }
    }

    // We need to set this option here, incase the module is loaded before `process.title` is set.
    if (! this.options.name) { this.options.name = process.title || process.argv.join(' ') }

    this.socket = null;
    this.retries = 0;
    this.queue = [];
};
this.Client.prototype = new(function () {
    var that = this;

    // Generate logging methods, such as `info`, `debug`, ...
    for (var k in exports) {
        if (/^LOG/.test(k)) {
            (function (level, name) {
                that[name] = function (msg) {
                    this.log(msg, exports[level]);
                };
            })(k, k.match(/^LOG_([A-Z]+)/)[1].toLowerCase());
        }
    }

    this.log = function (msg, severity) {
        var that = this;
        msg = msg.trim();
        severity = severity !== undefined ? severity : exports.LOG_INFO;

        if (severity === exports.LOG_DEBUG && !this.options.debug) { return }


        this.connect(function (e) {


            var pri = '<' + ((that.options.facility * 8) + severity) + '>'; // Message priority
            var entry = pri + [
                new(Date)().toJSON(),
                hostname,
                that.options.name + '[' + process.pid + ']:',
                msg
            ].join(' ') + '\n';

            //
            // If there's a connection problem,
            // queue the message for later processing.
            //
            if (e) {
                that.queue.push(entry);
            // Write the entry to the socket
            } else {
                //that.socket.write(entry, 'utf8', function (e) {
                //    if (e) { that.queue.push(entry) }
                //});
				var buf=new Buffer(entry,"utf-8");
				that.socket.send(buf, 0, buf.length, that.port, that.host, function(err, bytes){
					var emsg='';
					if(err) {
						emsg='error sending message';
					}
					else {
						emsg=bytes+' bytes sent';
					}
				});
            }
        });
    };
    this.connect = function (callback) {
        var that = this;

        callback = callback || function () {};

        if (this.socket) {
			callback(null);
        } else {
			this.socket=dgram.createSocket('udp4');
			this.socket.on('error',function(err){
				that.connected = false;
			});
			this.socket.on('close',function(err){
				that.connected = false;
			});
			this.queue.forEach(function(entry){
				var buf=new Buffer(entry,"utf-8");
				that.socket.send(buf, 0, buf.length, that.port, that.host, function(err, bytes){
					var emsg='';
					if(err) {
						emsg='error sending message';
					}
					else {
						emsg=bytes+' bytes sent';
					}
				});
			});

			that.queue = [];
			that.retries = 0;
			that.connected = true;

			callback(null);
        }
    };
});

this.createClient = function (port, host, options) {
    return new(this.Client)(port, host, options);
};

