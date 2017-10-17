import { IpcPacketNet as BaseIpc } from 'socket-serializer';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport, IpcBusCommand, IpcBusData } from './IpcBusTransport';
import { IpcPacketBuffer } from 'socket-serializer';

// Implementation for Node process
/** @internal */
export class IpcBusTransportNode extends IpcBusTransport {
    protected _baseIpc: BaseIpc;
    protected _busConn: any;
    private _promiseConnected: Promise<string>;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcBusProcess, ipcOptions);
    }

    protected _onClose() {
        this._reset();
    }

    private _reset() {
        this._promiseConnected = null;
        if (this._busConn) {
            this._busConn.end();
            this._busConn = null;
        }
        if (this._baseIpc) {
            this._baseIpc.removeAllListeners();
            this._baseIpc = null;
        }
    }

    /// IpcBusTransport API
    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            p = this._promiseConnected = new Promise<string>((resolve, reject) => {
                if (peerName == null) {
                    peerName = `${this._ipcBusPeer.process.type}_${this._ipcBusPeer.process.pid}`;
                }
                this._ipcBusPeer.name = peerName;
                let timer: NodeJS.Timer;
                // Below zero = infinite
                if (timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        this._reset();
                        reject('timeout');
                    }, timeoutDelay);
                }
                this._baseIpc = new BaseIpc();
                this._baseIpc.on('connect', (conn: any) => {
                    this._busConn = conn;
                    if (this._baseIpc) {
                        clearTimeout(timer);
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, '', {});
                        resolve('connected');
                    }
                    else {
                        this._reset();
                    }
                });
                this._baseIpc.on('packet', (packet: IpcPacketBuffer) => {
                    let args = packet.parseArray();
                    let ipcBusCommand: IpcBusCommand = args.shift();
                    // console.log(`packet`);
                    // console.log(JSON.stringify(ipcBusCommand, null, 4));
                    if (ipcBusCommand && ipcBusCommand.name) {
                        this._onEventReceived(ipcBusCommand, args);
                    }
                    else {
                        // console.log(JSON.stringify(ipcBusCommand, null, 4));
                        // console.log(args);
                        throw "IpcBusTransportNode: Not valid packet !";
                    }
                });
                this._baseIpc.on('close', (conn: any) => {
                    this._onClose();
                    reject('server close');
                });
                this._baseIpc.connect(this.ipcOptions.port, this.ipcOptions.host);
            });
        }
        return p;
    }

    ipcClose() {
        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CLOSE, '', {});
        this._reset();
    }

    ipcPushCommand(command: string, channel: string, ipcBusData: IpcBusData, args?: any[]): void {
        this._ipcPushCommand({ name: command, channel: channel, peer: this.peer, data: ipcBusData }, args);
    }

    protected _ipcPushCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        if (this._busConn) {
            if (args) {
                args = [ipcBusCommand, ...args];
            }
            else {
                args = [ipcBusCommand];
            }
            let packet = new IpcPacketBuffer();
            packet.serializeArray(args);
            // let bytesWritten = packet.buffer.length;
            this._busConn.write(packet.buffer);

            // let bytesWritten = IpcPacketBuffer.fromToSocket(args, this._busConn);
            // console.log(`ipcBusCommand ${bytesWritten}`);
            // console.log(JSON.stringify(ipcBusCommand, null, 4));
        }
    }
}
