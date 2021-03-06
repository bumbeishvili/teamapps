/*-
 * ========================LICENSE_START=================================
 * TeamApps
 * ---
 * Copyright (C) 2014 - 2019 TeamApps.org
 * ---
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =========================LICENSE_END==================================
 */
import {UiClientInfoConfig} from "../generated/UiClientInfoConfig";
import {TeamAppsConnection, TeamAppsConnectionListener} from "../shared/TeamAppsConnection";

///<reference path="../custom-declarations/worker-loader.d.ts"/>

export class WebWorkerTeamAppsConnection implements TeamAppsConnection {

	private worker: Worker;

	constructor(webSocketUrl: string, sessionId: string, clientInfo: UiClientInfoConfig, commandHandler: TeamAppsConnectionListener) {
		// let x = WebpackWorker;
		// console.log(x);
		// this.worker = new (WebpackWorker as any)() as Worker; // TODO use webpack to set this path!
		this.worker = new Worker("/js/communication-worker.js");
		this.worker.postMessage({webSocketUrl, sessionId, clientInfo});

		this.worker.onmessage = (e: MessageEvent): any => {
			if (e.data._type === 'onCommand') {
				commandHandler.executeCommand(e.data.uiCommand);
			} else if (e.data._type === 'onCommands') {
				commandHandler.executeCommands(e.data.uiCommands);
			} else if (e.data._type === 'onConnectionBroken') {
				commandHandler.onConnectionErrorOrBroken(e.data.reason, e.data.message);
			} else if (e.data._type === 'onConnectionInitialized') {
				commandHandler.onConnectionInitialized();
			} else {
				console.error("Unknown type of message received from web worker: " + JSON.stringify(e.data));
			}
		};
	}

	sendEvent(event: any): void {
		this.worker.postMessage({event});
	}

}
