//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

window.ipcBus = require('electron-common-ipc').CreateIpcBusClient();
window.ipcBus_QUERYSTATE_CHANNEL = require('electron-common-ipc').IPCBUS_CHANNEL_QUERY_STATE;
require('electron-common-ipc').ActivateIpcBusTrace(true);

window.ipcRenderer = require('electron').ipcRenderer;

const PerfTests = require('./PerfTests.js');
window.perfTests = new PerfTests('renderer');


