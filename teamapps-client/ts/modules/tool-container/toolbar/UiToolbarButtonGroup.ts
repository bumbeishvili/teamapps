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
import {UiToolbarButtonGroupConfig} from "../../../generated/UiToolbarButtonGroupConfig";
import {OrderedDictionary} from "../../util/OrderedDictionary";
import {UiToolbarButton} from "./UiToolbarButton";
import {TeamAppsUiContext} from "../../TeamAppsUiContext";
import * as $ from "jquery";
import {UiToolbarButtonConfig} from "../../../generated/UiToolbarButtonConfig";
import {UiComponent} from "../../UiComponent";
import {ButtonVisibilities, UiToolbar} from "./UiToolbar";
import {UiDropDownButtonClickInfoConfig} from "../../../generated/UiDropDownButtonClickInfoConfig";
import {TeamAppsEvent} from "../../util/TeamAppsEvent";

export class UiToolbarButtonGroup {
	public readonly onButtonClicked: TeamAppsEvent<{buttonId: string, dropDownButtonClickInfo: UiDropDownButtonClickInfoConfig}> = new TeamAppsEvent(this);
	public readonly onDropDownItemClicked: TeamAppsEvent<{buttonId: string, groupId: string, itemId: number}> = new TeamAppsEvent(this);

	private config: UiToolbarButtonGroupConfig;
	private visible: boolean = true;
	private $buttonGroupWrapper: JQuery;
	private $buttonGroup: JQuery;
	private buttons: OrderedDictionary<UiToolbarButton>;
	private $separator: JQuery;
	private buttonsShiftedToOverflowDropDown: UiToolbarButton[] = [];

	constructor(buttonGroupConfig: UiToolbarButtonGroupConfig, private toolbar: UiToolbar, private context: TeamAppsUiContext) {
		const $buttonGroupWrapper = $('<div class="button-group-wrapper"/>');

		const $buttonGroup = $(`<div class="toolbar-button-group" id="${this.toolbarId}_${buttonGroupConfig.groupId}">`)
			.appendTo($buttonGroupWrapper);

		this.config = buttonGroupConfig;
		this.$buttonGroupWrapper = $buttonGroupWrapper;
		this.$buttonGroup = $buttonGroup;
		this.buttons = new OrderedDictionary<UiToolbarButton>();

		for (let j = 0; j < buttonGroupConfig.buttons.length; j++) {
			const buttonConfig: UiToolbarButtonConfig = buttonGroupConfig.buttons[j];
			const button = this.createButton(buttonConfig);
			this.buttons.push(buttonConfig.buttonId, button);
			$buttonGroup.append(button.getMainDomElement());
		}

		if (buttonGroupConfig.showGroupSeparator) {
			this.$separator = $('<div class="toolbar-group-separator">');
			$buttonGroupWrapper.append(this.$separator);
		}

		this.setVisible(buttonGroupConfig.visible);


	}

	public getId() {
		return this.config.groupId;
	}

	private get toolbarId() {
		return this.toolbar.getId();
	}

	public get position() {
		return this.config.position;
	}

	private createButton(buttonConfig: UiToolbarButtonConfig) {
		const button = new UiToolbarButton(buttonConfig, this.context);
		button.onClicked.addListener(dropDownButtonClickInfo => this.onButtonClicked.fire({buttonId: buttonConfig.buttonId, dropDownButtonClickInfo}));
		button.onDropDownItemClicked.addListener(e => this.onDropDownItemClicked.fire({buttonId: buttonConfig.buttonId, ...e}));
		return button;
	}

	public setDropDownComponent(buttonId: string, component: UiComponent) {
		this.buttons.getValue(buttonId).setDropDownComponent(component);
	}

	public setButtonVisible(buttonId: string, visible: boolean) {
		const button = this.buttons.getValue(buttonId);
		if (button) {
			button.setVisible(visible);
			this.updateVisibility();
		}
	}

	public addButton(buttonConfig: UiToolbarButtonConfig, neighborButtonId: string, beforeNeighbor: boolean) {
		const button = this.createButton(buttonConfig);

		const existingButton = this.buttons.getValue(buttonConfig.buttonId);
		if (existingButton) {
			this.removeButton(buttonConfig.buttonId);
		}

		const neighborButton = this.buttons.getValue(neighborButtonId);
		if (neighborButton) {
			if (beforeNeighbor) {
				button.getMainDomElement().insertBefore(neighborButton.getMainDomElement());
				this.buttons.insertBeforeValue(buttonConfig.buttonId, button, neighborButton);
			} else {
				button.getMainDomElement().insertAfter(neighborButton.getMainDomElement());
				this.buttons.insertAfterValue(buttonConfig.buttonId, button, neighborButton);
			}
		} else {
			button.getMainDomElement().appendTo(this.$buttonGroup);
			this.buttons.push(buttonConfig.buttonId, button);
		}

		this.updateVisibility();
	}

	public removeButton(buttonId: string): void {
		const button = this.buttons.getValue(buttonId);

		if (button) {
			this.buttons.remove(buttonId);
			button.getMainDomElement().detach();
		}

		// TODO destroy dropdown

		this.updateVisibility();
	}

	public setVisible(visible: boolean) {
		this.visible = visible;
		this.updateVisibility();
	}

	public isVisible() {
		return this.visible;
	}

	private updateVisibility() {
		let hasVisibleButton = this.buttons.values.some(button => {
			return button.isVisible() && this.buttonsShiftedToOverflowDropDown.indexOf(button) === -1;
		});
		this.$buttonGroupWrapper.toggleClass("pseudo-hidden", !(this.visible && hasVisibleButton));
	}

	public calculateButtonVisibilities(availableWidth: number): ButtonVisibilities {
		let info: ButtonVisibilities = {
			fittingButtons: [],
			nonFittingButtons: [],
			hiddenButtons: []
		};
		let usedWidth = this.$separator ? this.$separator.outerWidth(true) : 0;
		this.buttons.values.forEach((button) => {
			if (this.visible && button.isVisible()) {
				if (usedWidth + button.optimizedWidth <= availableWidth) {
					this.buttonsShiftedToOverflowDropDown = this.buttonsShiftedToOverflowDropDown.filter(b => b !== button);
					info.fittingButtons.push({groupId: this.config.groupId, buttonId: button.id, button});
				} else {
					this.buttonsShiftedToOverflowDropDown.push(button);
					info.nonFittingButtons.push({groupId: this.config.groupId, buttonId: button.id, button});
				}
				usedWidth += button.optimizedWidth;
			} else {
				this.buttonsShiftedToOverflowDropDown = this.buttonsShiftedToOverflowDropDown.filter(b => b !== button);
				info.hiddenButtons.push({groupId: this.config.groupId, buttonId: button.id, button});
			}
		});
		this.updateVisibility();
		return info;
	}

	public getMainDomElement(): JQuery {
		return this.$buttonGroupWrapper;
	}

	public getButtonConfigs() {
		return this.buttons.values.map(b => b.config);
	}

	setButtonHasDropDown(buttonId: string, hasDropDown: boolean) {
		this.buttons.getValue(buttonId).setHasDropDown(hasDropDown);
	}

	public getConfig() {
		return this.config;
	}
}
