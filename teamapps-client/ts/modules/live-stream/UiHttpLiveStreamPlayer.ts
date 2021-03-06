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
import * as $ from "jquery";
import {LiveStreamPlayer} from "./LiveStreamPlayer";
import {UiSpinner} from "../micro-components/UiSpinner";
import {UiComponent} from "../UiComponent";
import {TeamAppsUiContext} from "../TeamAppsUiContext";
import {UiHttpLiveStreamPlayerConfig} from "../../generated/UiHttpLiveStreamPlayerConfig";

export class UiHttpLiveStreamPlayer extends UiComponent<UiHttpLiveStreamPlayerConfig> implements LiveStreamPlayer {
	private $main: JQuery;
	private $videoContainer: any;
	private $notSupportedMessage: any;
	private video: HTMLVideoElement;
	private url: string;
	private shouldBePlayingUnlessUserPressedPause: boolean;
	private $spinnerContainer: JQuery;
	private resetTimer: number = null;

	constructor(config: UiHttpLiveStreamPlayerConfig, context: TeamAppsUiContext) {
		super(config, context);
		this.$main = $(`
<div class="HttpLiveStreamPlayer">
    <div class="not-supported-message">
        HTML5 or HLS are not supported in this browser.
    </div>
    <div class="video-container">
    	<div class="spinner-container hidden"></div>	
        <video x-webkit-airplay="allow" autoplay controls/>
    </div>
</div>			
`);
		this.$spinnerContainer = this.$main.find('.spinner-container');
		this.$spinnerContainer.append(new UiSpinner().getMainDomElement());
		this.$notSupportedMessage = this.$main.find('.not-supported-message');
		this.$videoContainer = this.$main.find('.video-container');

		this.video = this.$main.find('video')[0] as HTMLVideoElement;
		this.video.addEventListener("error", this.failed.bind(this));
		this.video.addEventListener("load", () => this.video.play());
		['loadedmetadata', 'loadstart', 'loadeddata', 'playing', 'stalled', 'suspend', 'waiting', 'canplay', 'canplaythrough'].forEach(eventName => {
			this.video.addEventListener(eventName, () => {
				this.logger.debug(eventName + "; videoTracks: " + this.video.videoTracks.length + "; audioTracks: " + this.video.audioTracks.length);
				this.updateState();
			})
		});

		let supported = this.isHlsSupported();
		this.$notSupportedMessage.toggleClass('hidden', supported);
		this.$videoContainer.toggleClass('hidden', !supported);
	}

	public isHlsSupported() {
		return !!(this.video.canPlayType && this.video.canPlayType('application/x-mpegURL') && this.video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'));
	}

	public play(url: string) {
		this.stop();
		this.logger.info("Will play: " + url);
		this.shouldBePlayingUnlessUserPressedPause = true;
		this.url = url;
		this.retryPlaying();
	}

	private retryPlaying() {
		clearTimeout(this.resetTimer);
		this.resetTimer = null;
		let shouldRetry = this.shouldBePlayingUnlessUserPressedPause && !this.isActuallyReadyToPlay();
		this.logger.debug("retryPlaying: " + shouldRetry);
		if (shouldRetry) {
			// this.video.pause();
			// $(this.video)[0].innerHTML = '';
			// $(this.video).append(`<source src="${this.url}" type="application/vnd.apple.mpegurl">`);
			$(this.video).attr('src', this.url);
			this.video.play();
		}
	}

	public stop() {
		this.shouldBePlayingUnlessUserPressedPause = false;
		this.video.pause();
		this.video.src = null;
		$(this.video)[0].innerHTML = '';
		this.video.load();
	}

	public isPlaying(): boolean {
		return this.shouldBePlayingUnlessUserPressedPause;
	}

	public setVolume(volume: number): void {
		this.video.volume = volume;
	}

	private updateState() {
		let playingOrReady = this.isActuallyReadyToPlay();
		if (playingOrReady) {
			clearTimeout(this.resetTimer);
			this.resetTimer = null;
		} else if (this.resetTimer == null) {
			this.resetTimer = window.setTimeout(() => this.retryPlaying(), 15000);
		}
		this.$spinnerContainer.toggleClass("hidden", !this.shouldBePlayingUnlessUserPressedPause || playingOrReady);
	}

	private isActuallyReadyToPlay() {
		return this.video.readyState >= 4;
	}

	private failed(e: ErrorEvent) {
		this.logger.warn('Error while playing video: ' + this.video.error.code);
		switch (this.video.error.code) {
			case MediaError.MEDIA_ERR_ABORTED:
				this.logger.error('Video playback was aborted.');
				break;
			case MediaError.MEDIA_ERR_NETWORK:
				this.logger.error('A network error caused the video download to fail part-way.');
				break;
			case MediaError.MEDIA_ERR_DECODE:
				this.logger.error('The video playback was aborted due to a corruption problem or because the video used features your browser did not support.');
				break;
			case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
				this.logger.error('The video could not be loaded, either because the server or network failed or because the format is not supported.');
				break;
			default:
				this.logger.error('An unknown error occurred.');
				break;
		}
		clearTimeout(this.resetTimer);
		this.resetTimer = window.setTimeout(() => this.retryPlaying(), 5000);
	}

	getMainDomElement(): JQuery {
		return this.$main;
	}

	destroy(): void {
		// nothing to do...
	}
}
