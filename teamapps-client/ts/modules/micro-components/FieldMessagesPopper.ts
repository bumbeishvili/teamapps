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
import Popper from "popper.js";
import {UiFieldMessageConfig} from "../../generated/UiFieldMessageConfig";
import {UiFieldMessagePosition} from "../../generated/UiFieldMessagePosition";
import {UiFieldMessageSeverity} from "../../generated/UiFieldMessageSeverity";
import {UiFieldMessageVisibilityMode} from "../../generated/UiFieldMessageVisibilityMode";

export class FieldMessagesPopper {

	private referenceElement: Element;
	private popper: Popper;
	private $popperElement: JQuery;
	private $messagesContainer: JQuery;

	constructor(referenceElement?: Element | null) {
		this.referenceElement = referenceElement;
		this.$popperElement = $(`<div class="tooltip ${referenceElement != null ? "" : "hidden"}" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>`)
			.appendTo(document.body);
		this.$messagesContainer = this.$popperElement.find(".tooltip-inner");
		this.popper = new Popper(referenceElement || document.body, this.$popperElement[0], {
			placement: 'right',
			modifiers: {
				flip: {
					behavior: ['right', 'bottom', 'left', 'top']
				},
				preventOverflow: {
					boundariesElement: document.body,
				}
			},
		});
	}

	public setMessages(messages: UiFieldMessageConfig[] = []) {
		this.$messagesContainer[0].innerHTML = '';
		if (messages.length > 0) {
			const highestSeverity = getHighestSeverity(messages);
			this.$popperElement
				.removeClass(`tooltip-info tooltip-success tooltip-warning tooltip-error`)
				.addClass(`tooltip-${UiFieldMessageSeverity[highestSeverity].toLowerCase()}`);
			messages.forEach(message => {
				this.$messagesContainer.append(createMessageElement(message));
			});
			this.$popperElement.removeClass("empty");
			this.popper.update();
		} else {
			this.$popperElement.addClass("empty");
		}
		this.popper.update();
	}

	public setReferenceElement(referenceElement: Element) {
		(this.popper as any).reference = referenceElement;
		this.popper.update();
	}

	public updatePosition() {
		this.popper.update();
	}

	public setVisible(visible: boolean) {
		this.$popperElement.toggleClass("hidden", !visible);
		this.popper.update();
	}

	public destroy() {
		this.popper.destroy();
		this.$popperElement.detach();
	}
}

export function getHighestSeverity (messages: UiFieldMessageConfig[], defaultSeverity: UiFieldMessageSeverity | null = UiFieldMessageSeverity.INFO) {
	if (messages == null) {
		return defaultSeverity;
	}
	return messages.reduce((highestSeverity, message) => (highestSeverity == null || message.severity > highestSeverity) ? message.severity : highestSeverity, defaultSeverity);
}

export function createMessageElement(message: UiFieldMessageConfig) {
	const severityCssClass = `field-message-${UiFieldMessageSeverity[message.severity].toLowerCase()}`;
	const positionCssClass = `position-${UiFieldMessagePosition[message.position].toLowerCase()}`;
	const visibilityCssClass = `visibility-${UiFieldMessageVisibilityMode[message.visibilityMode].toLowerCase()}`;
	return $(`<div class="field-message ${severityCssClass} ${positionCssClass} ${visibilityCssClass}">${message.message}</div>`);
}
