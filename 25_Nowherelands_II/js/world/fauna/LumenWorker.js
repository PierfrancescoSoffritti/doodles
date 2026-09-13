import {createLumenRuntime} from './LumenWorkerRuntime.js?v=stable-30-25';
self.onmessage=createLumenRuntime(null,(message,transfer=[])=>self.postMessage(message,transfer));
