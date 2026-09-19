import {createLumenRuntime} from './LumenWorkerRuntime.js?v=streaming-60-30-19';
self.onmessage=createLumenRuntime(null,(message,transfer=[])=>self.postMessage(message,transfer));
