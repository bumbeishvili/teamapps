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
import {UiField} from "./UiField";
import {TeamAppsUiContext} from "../TeamAppsUiContext";
import {UiLabel_ClickedEvent, UiLabelConfig, UiLabelCommandHandler, UiLabelEventSource} from "../../generated/UiLabelConfig";
import {TeamAppsEvent} from "../util/TeamAppsEvent";
import {UiFieldEditingMode} from "../../generated/UiFieldEditingMode";
import {TeamAppsUiComponentRegistry} from "../TeamAppsUiComponentRegistry";
import {EventFactory} from "../../generated/EventFactory";

export class UiLabel extends UiField<UiLabelConfig, string> implements UiLabelEventSource, UiLabelCommandHandler {
	public readonly onClicked: TeamAppsEvent<UiLabel_ClickedEvent> = new TeamAppsEvent<UiLabel_ClickedEvent>(this);

	private $main: JQuery;
	private $caption: JQuery;
	private targetField: UiField;
	private targetFieldVisibilityChangeHandler: (visible: boolean) => void;

	protected initialize(config: UiLabelConfig, context: TeamAppsUiContext): void {
		this.$main = $(`<div class="UiLabel"><span class="caption">${config.caption}</span></div>`);
		this.$caption = this.$main.find(".caption");
		this.setIcon(config.icon);
		this.$main.click(() => {
			this.onClicked.fire(EventFactory.createUiLabel_ClickedEvent(this.getId()));
			if (this.targetField != null) {
				this.targetField.focus();
			}
		});
		this.targetFieldVisibilityChangeHandler = (visible: boolean) => this.setVisible(visible);
		this.setTargetField(config.targetField);
	}

	public setTargetField(targetField: UiField) {
		if (this.targetField != null) {
			this.targetField.onVisibilityChanged.removeListener(this.targetFieldVisibilityChangeHandler)
		}
		this.targetField = targetField;
		if (targetField != null) {
			this.setVisible(targetField.isVisible());
			targetField.onVisibilityChanged.addListener(this.targetFieldVisibilityChangeHandler);
		}
	}

	isValidData(v: string): boolean {
		return v == null || typeof v === "string";
	}

	setCaption(caption: string): void {
		this.$caption.text(caption);
	}

	setIcon(icon: string): void {
		this.$main.find(".icon").detach();
		if (icon) {
			let iconPath = this._context.getIconPath(icon, 16);
			this.$main.prepend(`<div class="icon img img-16" style="background-image: url(${iconPath})"></div>`)
		}
	}

	public getMainInnerDomElement(): JQuery {
		return this.$main;
	}

	public getFocusableElement(): JQuery {
		return null;
	}

	public getTransientValue(): string {
		return this.getCommittedValue();
	}

	public getDefaultValue(): string {
		return null;
	}

	protected displayCommittedValue(): void {
		this.$caption.text(this.getCommittedValue() || this._config.caption || "");
	}

	protected onEditingModeChanged(editingMode: UiFieldEditingMode): void {
		// does not have any editing mode support...
	}

	public valuesChanged(v1: string, v2: string): boolean {
		return v1 !== v2;
	}
}

TeamAppsUiComponentRegistry.registerFieldClass("UiLabel", UiLabel);
