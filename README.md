M2M-SUPERVISOR 
====

[![Build Status](https://travis-ci.org/numerex/m2m-supervisor.svg)](https://travis-ci.org/numerex/m2m-supervisor)
[![Coverage Status](https://coveralls.io/repos/numerex/m2m-supervisor/badge.svg?branch=master)](https://coveralls.io/r/numerex/m2m-supervisor?branch=master)

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
* If PM2 is installed, you may use `pm2 start processes.json` from the project root to launch the following processes

Processes
----

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

* **bin/www-server** -- This is an "ExpressJS" and "AngularJS" web application that will do the following:
 * Monitor the status of the overall M2M-SUPERVISOR
 * Allow the remote setup of General and Device IO configuration
 * Support remote submission of local "shell" commands -- _**user caution is advised!**_

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

* **/bin/telnet-simulator** -- This process will listen on port 10001 for command sequences as defined in the `test-server/data/telnet-simulation-data.json` file and return the corresponding response.
In order to configure the **m2m-transceiver** to use the simulator, simply create a test device configuraion using the **web-server** by providing "localhost" as the Telnet Address --
everything else should be left as a default.