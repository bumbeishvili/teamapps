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
import {UiComponent} from "./UiComponent";
import {TeamAppsUiContext} from "./TeamAppsUiContext";
import {TeamAppsUiComponentRegistry} from "./TeamAppsUiComponentRegistry";
import {parseHtml} from "./Common";
import {UiFlexContainerCommandHandler, UiFlexContainerConfig} from "../generated/UiFlexContainerConfig";
import {UiCssFlexDirection} from "../generated/UiCssFlexDirection";
import {UiCssAlignItems} from "../generated/UiCssAlignItems";
import {UiCssJustifyContent} from "../generated/UiCssJustifyContent";

export class UiFlexContainer extends UiComponent<UiFlexContainerConfig> implements UiFlexContainerCommandHandler {

	private $main: HTMLDivElement;
	private components: UiComponent[] = [];

	constructor(config: UiFlexContainerConfig, context: TeamAppsUiContext) {
		super(config, context);
		this.$main = parseHtml(`<div class="UiFlexContainer"></div>`);
		this.$main.style.flexDirection = this.convertToCssValueString(UiCssFlexDirection[config.flexDirection]);
		this.$main.style.alignItems = this.convertToCssValueString(UiCssAlignItems[config.alignItems]);
		this.$main.style.justifyContent = this.convertToCssValueString(UiCssJustifyContent[config.justifyContent]);

		config.components.forEach(c =>this.addComponent(c));
	}

	private convertToCssValueString(enumValueName: string) {
		return enumValueName.toLowerCase().replace("_", "-");
	}

	protected onAttachedToDom(): void {
		this.components.forEach(c => c.attachedToDom = true);
	}

	onResize(): void {
		this.components.forEach(c => c.reLayout());
	}

	getMainDomElement(): JQuery {
		return $(this.$main);
	}

	addComponent(component: UiComponent): void {
		this.components.push(component);
		this.$main.appendChild(component.getMainDomElement()[0]);
	}

	removeComponent(component: UiComponent): void {
		this.$main.removeChild(component.getMainDomElement()[0]);
		this.components = this.components.filter(c => c !== component);
	}

}

TeamAppsUiComponentRegistry.registerComponentClass("UiFlexContainer", UiFlexContainer);
