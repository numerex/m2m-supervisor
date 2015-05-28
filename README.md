M2M-SUPERVISOR 
====

[![Build Status](https://travis-ci.org/numerex/m2m-supervisor.svg)](https://travis-ci.org/numerex/m2m-supervisor)
[![Coverage Status](https://coveralls.io/repos/numerex/m2m-supervisor/badge.svg?branch=master)](https://coveralls.io/r/numerex/m2m-supervisor?branch=master)

[![NPM](https://nodei.co/npm/m2m-supervisor.png)](https://npmjs.org/package/m2m-supervisor)

The M2M-SUPERVISOR contains a set of processes that can run on an embedded processing platform (such as the Beaglebone)
that can perform the following tasks:

* Ensure that a cellular wireless connection (PPP) is continuously available
* Provide public and private data routing to a "mothership" services platform
* Perform "least-cost-routing" based on configuration using public/private pathways
* Coordinate Mobile Originated (MO) and Terminated (MT) messaging
* Provide a framework for application-specific processing of business logic

Dependencies
----

* Redis should be running on the default port
* If PM2 is installed, you may use `pm2 start processes.json` from the project root to launch the **m2m-supervisor**

Processes
----

* **bin/m2m-supervisor** -- This process combines all of the following process elements into a single instance...

* **bin/m2m-bridge** -- This process will do the following:
 * Wait for Redis to be available, then...
 * Ensure that PPPD is running, then...
 * Ensure that a dedicated route exists to the gateway server private IP, then...
 * Discover the device's IMEI, then...
 * Request RSSI from the modem every minute
 * Collect FLOW information from the modem
 * Send a "heartbeat" on startup and again every hour
 * Listen on ports 4000 and 4001 for locally-routed messages to the gateway sent to its private and public IPs respectively
 * Listen for incoming "command" and "ack" messages and deposit them in Redis for the **m2m-transceiver** to process

* **bin/m2m-transceiver** -- This process will do the following:
 * Wait for Redis to be available and for the gateway configuration (specifically IMEI) to be available, then...
 * Build "device routers" for each configured device in Redis
 * Check the "transmit" queue for messages to be sent to the gateway via the **m2m-bridge**, but only if no outstanding message is waiting for an "ack"
 * Check the "ack" queue for the arrival matching "ack" messages from the gateway via the **m2m-bridge**
 * Check the queue of each "device router" and distribute an inbound "command" message to it for processing

* **bin/m2m-web-server** -- This is an "ExpressJS" and "AngularJS" web application that will do the following:
 * Monitor the status of the overall M2M-SUPERVISOR
 * Allow the remote setup of General and Device IO configuration
 * Support remote submission of local "shell" commands -- _**user caution is advised!**_
 
Additional processes:
 
* **bin/m2m-web-proxy** -- This is a special version of the **m2m-web-server** that assumes that it will only function as a proxy for all access to M2M Supervisor functionality,
with the one exception of Device Template information -- this is assumed to be standard for all remote M2M Supervisors and will be satisfied locally to avoid unnecessary communications over possibly-costly remote channels.

Configuration Options
----

* **Gateway**
 * Private and Public IP/Port values for accessing the gateway
 * Private and Public "Relay" Ports for locally-routing messages to the gateway via the **m2m-bridge**
 * Primary Route to the gateway -- either "public" or "private" -- the default it "public"

* **Device IO**
 * Communication Type -- either "telnet" or "serial"
 * Telnet Address/Port values for communicating to a "telnet" device
 * Serial Port/Baud-Rate values for communicating to a "serial" device

Testing
----

This project is committed to maintaining full coverage for test suites of the operational code.
In addition, it includes simulation tools to aid development and on-device testing:

* **bin/command-loader** -- This tool will take a TSV file containing device profile settings and a set of command definitions, including schedule periods for "read" commands.
    * Current the valid profile settings are as follows:
        * `name` -- This will be an optional name of the device profile; if not provided, the profile name will be the base file name.
        * `description` -- This is an optional description.
        * `command:command-prefix` -- This is an optional JSON-encoded string (e.g., "\u0001") that will be added before each command when submitted to the device.
        * `command:command-suffix` -- This is an optional JSON-encoded string (e.g., "\u0003") that will be added after each command when submitted to the device.
        * `command:response-prefix` -- This is a required JSON-encoded string expected to begin a serial or telnet response from the device.
        * `command:response-suffix` -- This is a required JSON-encoded string expected to terminate a serial or telnet response from the device.
    * After any profile definitions, the TSV file must have a single header row that will determine how the following rows defining commands will be interpretted:
        * `key` -- This is a required field and values must be unique in the subsequent rows.
        * `label` -- This is an optional field and if not provided, or if the values below are blank, the `key` will be used as the `label`.
        * `read(:<command-type>)` -- This is an expected field whose values are assumed to inquire data from the device; an optional <command-type> may be appended to distinguish different types of commands (e.g., "display" or "computer").
        * `write(:<command-type)` -- This is an optional field whose values are assumed to change data on the device; an optional <command-type> is also possible.
        * `period(:<command-type)` -- This is an optional field whose integer values, if provided, are assumed to indicate that the associated `read(:<command-type>)` command should be submitted to the device ever so-many seconds.
        * `attr:<keyword>` -- This is an optional field that may repeat with different values for <keyword> to allow user-defined attributes to be associated with individual commands; the unique list of values will be available for categorizing the commands in the web application.

* **bin/data-tester** -- This tool will take a device key on the command line -- none will assume a single device configured -- and, if it exists in Redis, will allow commands to be entered, displaying the response on the console.

* **bin/m2m-sys-check** -- This tool will check to ensure that key dependencies are installed on the device and will collect key information like modem data/control ports, along with vendor, model, and version.

* **bin/m2m-sys-config** -- Assuming that it can confirm the existence of Redis, an IMEI, and a valid "control" port for the modem, this tool will configure these key Redis configuration attributes.

* **bin/telnet-finder** -- This tool calls `ifconfig` -- tested on Mac OSX and Debian -- to find IP interfaces and scans the associated subnets for hosts allowing TCP connections on the Telnet port (default: 10001).
It responds to the `--help` option for more details.

* **bin/telnet-simulator** -- This process will listen on port 10001 for command sequences as defined in the `test-server/data/telnet-simulation-data.json` file and return the corresponding response.
In order to configure the **m2m-transceiver** to use the simulator, simply create a test device configuraion using the **web-server** by providing "localhost" as the Telnet Address --
everything else should be left as a default.
