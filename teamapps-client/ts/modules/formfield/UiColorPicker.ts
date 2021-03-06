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
import {UiColorPickerConfig, UiColorPickerEventSource} from "../../generated/UiColorPickerConfig";
import {TeamAppsUiContext} from "../TeamAppsUiContext";
import {TeamAppsUiComponentRegistry} from "../TeamAppsUiComponentRegistry";
import {UiFieldEditingMode} from "../../generated/UiFieldEditingMode";
import {createUiColorConfig, UiColorConfig} from "../../generated/UiColorConfig";
import {create as createPickr, HSVaColor, Pickr} from "pickr-widget";
import {createUiColorCssString} from "../util/CssFormatUtil";
import {executeWhenAttached} from "../util/ExecuteWhenAttached";
import {keyCodes} from "trivial-components";

export class UiColorPicker extends UiField<UiColorPickerConfig, UiColorConfig> implements UiColorPickerEventSource {
	private $main: JQuery;
	private pickr: Pickr;
	private doNotCommit: boolean;

	protected initialize(config: UiColorPickerConfig, context: TeamAppsUiContext) {
		this.$main = $(`<div class="UiColorPicker" tabindex="-1"><div class="pickr"></div></div>`);
		this.doNotCommit = true;
		this.pickr = createPickr({
			el: this.$main.find('.pickr')[0],
			parent: document.body,
			position: "middle",

			default: createUiColorCssString(config.defaultColor),

			comparison: false,

			components: {

				preview: true,
				opacity: true,
				hue: true,

				interaction: {
					hex: true,
					rgba: true,
					hsla: true,
					hsva: true,
					input: true,
					save: true
				}
			},

			onChange: (color: HSVaColor) => {
				// TODO option for that?
			},
			onSave: (hsva, instance) => {
				if (!this.doNotCommit) {
					this.commit();
					this.$main.focus();
				}
			},

			strings: {
				save: config.saveButtonCaption,
				clear: config.clearButtonCaption
			}
		});
		this.doNotCommit = false;

		this.$main.on("keydown", (e) => {
			if (e.keyCode === keyCodes.enter || e.keyCode === keyCodes.space) {
				this.pickr.show();
			}
		});

		this.$main.find(".pcr-button").addClass("field-border field-border-glow");
	}

	isValidData(v: UiColorConfig): boolean {
		return v == null || (v.red != null && v.green != null && v.blue != null && v.alpha != null);
	}

	commit(forceEvenIfNotChanged?: boolean): boolean {
		return super.commit(forceEvenIfNotChanged);
	}

	@executeWhenAttached()
	protected displayCommittedValue(): void {
		let committedValue = this.getCommittedValue();
		if (committedValue != null && committedValue.alpha === 1) { // TODO https://github.com/Simonwep/pickr/issues/19
			committedValue = {...committedValue, alpha: .999999};
		}
		let colorString = committedValue != null ? createUiColorCssString(committedValue) : createUiColorCssString(this.getDefaultValue());

		try {
			this.doNotCommit = true;
			this.pickr.setColor(colorString);
		} finally {
			this.doNotCommit = false;
		}
	}

	getDefaultValue(): UiColorConfig {
		return this._config.defaultColor;
	}

	getFocusableElement(): JQuery {
		return this.$main;
	}

	getMainInnerDomElement(): JQuery {
		return this.$main;
	}

	getTransientValue(): UiColorConfig {
		const color = this.pickr.getColor();
		let rgb = color.toRGBA(); // the alpha value is buggy
		const uiColorConfig = createUiColorConfig(rgb[0], rgb[1], rgb[2], {alpha: color.a});
		return uiColorConfig;
	}

	protected onEditingModeChanged(editingMode: UiFieldEditingMode): void {
		if (editingMode === UiFieldEditingMode.DISABLED || editingMode === UiFieldEditingMode.READONLY) {
			this.pickr.disable();
		} else {
			this.pickr.enable();
		}
	}

	valuesChanged(v1: UiColorConfig, v2: UiColorConfig): boolean {
		return (v1 == null) !== (v2 == null)
			|| (v1 != null && v2 != null)
			&& (v1.red !== v2.red
				|| v1.green !== v2.green
				|| v1.blue !== v2.blue
				|| v1.alpha !== v2.alpha);
	}

	doDestroy(): void {
		this.pickr.destroyAndRemove();
	}

}

TeamAppsUiComponentRegistry.registerFieldClass("UiColorPicker", UiColorPicker);
