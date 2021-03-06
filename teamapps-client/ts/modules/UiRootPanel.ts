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
import * as moment from "moment-timezone";
import * as $ from "jquery";
import {UiComponentConfig} from "../generated/UiComponentConfig";
import {UiWindow, UiWindowListener} from "./UiWindow";
import {UiConfigurationConfig} from "../generated/UiConfigurationConfig";
import {UiWindowConfig} from "../generated/UiWindowConfig";
import {UiNotificationConfig} from "../generated/UiNotificationConfig";
import {UiComponent} from "./UiComponent";
import {TeamAppsUiContext, TeamAppsUiContextInternalApi} from "./TeamAppsUiContext";
import {convertJavaDateTimeFormatToMomentDateTimeFormat, exitFullScreen, insertAtIndex, showNotification} from "./Common";
import {UiRootPanelCommandHandler, UiRootPanelConfig} from "../generated/UiRootPanelConfig";
import {UiComponentRevealAnimation} from "../generated/UiComponentRevealAnimation";
import {TeamAppsUiComponentRegistry} from "./TeamAppsUiComponentRegistry";
import {UiTemplateConfig} from "../generated/UiTemplateConfig";
import * as log from "loglevel";
import {ElementUiComponentAdapter} from "./micro-components/ElementUiComponentAdapter";
import {UiGenericErrorMessageOption} from "../generated/UiGenericErrorMessageOption";
import {TeamAppsEvent, TeamAppsEventListener} from "./util/TeamAppsEvent";
import {UiColorConfig} from "../generated/UiColorConfig";
import {createUiColorCssString} from "./util/CssFormatUtil";

require("moment-jdateformatparser");


interface ChildComponent {
	$wrapper: JQuery,
	component: UiComponent<UiComponentConfig>
}

export class UiRootPanel extends UiComponent<UiRootPanelConfig> implements UiRootPanelCommandHandler {

	private static LOGGER: log.Logger = log.getLogger("UiRootPanel");
	private static ALL_ROOT_PANELS_BY_ID: { [id: string]: UiRootPanel } = {};
	private static BACKGROUND_IMAGES_BY_ID: {
		[index: string]: {
			image: string;
			blurredImage: string;
		}
	} = {};
	private static WINDOWS_BY_ID: { [windowId: string]: UiWindow } = {};

	private $root: JQuery;
	private childComponentsById: {[id: string]: ChildComponent} = {};
	private visibleChildComponent: ChildComponent;
	private $backgroundTransitionStyle: JQuery;
	private $backgroundStyle: JQuery;
	private $imagePreloadDiv: JQuery;

	private backgroundImage: string;
	private blurredBackgroundImage: string;
	private backgroundColor: string;

	static __initialize() {
		$(window).resize((e) => {
			this.ALL_ROOT_PANELS.forEach(rootPanel => {
				rootPanel.reLayout();
			});
			Object.keys(this.WINDOWS_BY_ID).map(id => this.WINDOWS_BY_ID[id]).forEach(window => window.reLayout());
		});
	}

	constructor(config: UiRootPanelConfig, context: TeamAppsUiContext) {
		super(config, context);
		UiRootPanel.ALL_ROOT_PANELS_BY_ID[config.id] = this;

		this.$root = $(`<div data-background-container-id="${config.id}" class="UiRootPanel teamapps-backgroundImage">
              <div class="image-preload-div"></div>
              <style data-style-type="backgroundTransitionStyle"></style>
              <style data-style-type="backgroundStyle"></style>
              <style></style>
		</div>`);
		this.$imagePreloadDiv = this.$root.find(".image-preload-div");
		this.$backgroundTransitionStyle = this.$root.find("[data-style-type='backgroundTransitionStyle']");
		this.$backgroundStyle = this.$root.find("[data-style-type='backgroundStyle']");

		if (config.childComponents != null && config.childComponents.length > 0) {
			config.childComponents.forEach(c => this.addChildComponent(c, false));
			this.setVisibleChildComponent(config.visibleChildComponentId || config.childComponents[0].id, null, 0);
		}

		this.setOptimizedForTouch(context.config.optimizedForTouch);
	}

	public getMainDomElement(): JQuery {
		return this.$root;
	}

	public addChildComponent(component: UiComponent, show: boolean) {
		let $childComponentContainer = $(`<div class="child-component-wrapper ${show ? 'active' : ''}">`)
			.appendTo(this.$root);
		component.getMainDomElement().appendTo($childComponentContainer);
		this.childComponentsById[component.getId()] = {
			component: component,
			$wrapper: $childComponentContainer
		};
		component.attachedToDom = this.attachedToDom;
		if (show) {
			this.setVisibleChildComponent(component.getId(), null, 0);
		}
	}

	public setVisibleChildComponent(childComponentId: string, animation: UiComponentRevealAnimation | null, animationDuration: number): void {
		if (childComponentId == null) {
			this.visibleChildComponent = null;
			this.childComponents.forEach(c => c.$wrapper.removeClass('active'));
		} else {
			let childComponent = this.childComponentsById[childComponentId];
			if (childComponent) {
				this.visibleChildComponent = childComponent;
				this.childComponents.forEach(c => c.$wrapper.removeClass('active'));
				childComponent.$wrapper.addClass('active');
				this.visibleChildComponent.component.reLayout();
			}
		}
	}

	public removeChildComponent(childComponentId: string): void {
		let childComponent = this.childComponentsById[childComponentId];
		delete this.childComponentsById[childComponentId];
		if (childComponent) {
			childComponent.$wrapper.detach();
		}
	}

	private get childComponents() {
		return Object.keys(this.childComponentsById).map(id => this.childComponentsById[id]);
	}

	public static createComponent(config: UiComponentConfig, context: TeamAppsUiContextInternalApi) {
		context.createAndRegisterComponent(config);
	}

	public static destroyComponent(component: UiComponent, context: TeamAppsUiContextInternalApi) {
		context.destroyComponent(component);
	}

	public static refreshComponent(config: UiComponentConfig, context: TeamAppsUiContextInternalApi) {
		context.refreshComponent(config);
	}

	public static setConfig(config: UiConfigurationConfig, context: TeamAppsUiContext) {
		let oldConfig = context.config;
		if (!oldConfig || oldConfig.isoLanguage !== config.isoLanguage) {
			$.getScript("runtime-resources/moment-locales/" + config.isoLanguage + ".js");
			$.getScript("runtime-resources/fullcalendar-locales/" + config.isoLanguage + ".js");
		}
		moment.locale(config.isoLanguage);
		config.dateFormat = convertJavaDateTimeFormatToMomentDateTimeFormat(config.dateFormat);
		config.timeFormat = convertJavaDateTimeFormatToMomentDateTimeFormat(config.timeFormat);
		this.setThemeClassName(config.themeClassName);

		this.ALL_ROOT_PANELS.forEach(uiRootPanel => {
			uiRootPanel.setOptimizedForTouch(config.optimizedForTouch);
		});

		this.LOGGER.warn("TODO Setting configuration on context. This should be implemented using an event instead!");
		(context as any).config = config; // TODO change this to firing an event to the context!!!!
	}

	public static setPageTitle(pageTitle: string) {
		document.title = pageTitle;
	}

	private static get ALL_ROOT_PANELS() {
		return Object.keys(this.ALL_ROOT_PANELS_BY_ID).map(id => this.ALL_ROOT_PANELS_BY_ID[id]);
	}

	public static registerBackgroundImage(id: string, image: string, blurredImage: string) {
		if (!id) {
			this.LOGGER.error(`Cannot register background image. Missing id!`);
			return;
		}
		if (!image) {
			this.LOGGER.warn(`Missing background image for image registration! (Still registering...)`);
		}
		if (!blurredImage) {
			blurredImage = image;
		}

		(new Image()).src = image; // preload
		(new Image()).src = blurredImage; // preload

		this.BACKGROUND_IMAGES_BY_ID[id] = {image, blurredImage};
	}

	public static setBackgroundImage(id: string, animationDuration: number) {
		let backgroundImage: string = null;
		let blurredBackgroundImage: string = null;
		if (id != null) {
			let registeredImage = this.BACKGROUND_IMAGES_BY_ID[id];
			if (!registeredImage) {
				this.LOGGER.warn(`Background image with id ${id} does not exist!`);
				return;
			}
			backgroundImage = registeredImage.image;
			blurredBackgroundImage = registeredImage.blurredImage;
		}
		this.ALL_ROOT_PANELS.forEach(uiRootPanel => {
			uiRootPanel.backgroundImage = backgroundImage;
			uiRootPanel.blurredBackgroundImage = blurredBackgroundImage;
			uiRootPanel.updateBackground(animationDuration);
		});
	}

	public static setBackgroundColor(backgroundColor: UiColorConfig, animationDuration: number) {
		this.ALL_ROOT_PANELS.forEach(uiRootPanel => {
			uiRootPanel.backgroundColor = backgroundColor && createUiColorCssString(backgroundColor);
			uiRootPanel.updateBackground(animationDuration);
		})
	}

	private updateBackground(animationDuration: number) {
		this.$backgroundTransitionStyle.text(`
                /*[data-background-container-id='${this.getId()}']*/ .teamapps-backgroundImage,
                /*[data-background-container-id='${this.getId()}']*/ .teamapps-blurredBackgroundImage {
                    transition: background-image ${animationDuration}ms ease-in-out, background-color ${animationDuration}ms ease-in-out;
                }
            `);
		this.$root[0].clientWidth; // ensure the css is applied!
		this.$backgroundStyle.text(`
				/*[data-background-container-id='${this.getId()}']*/.teamapps-backgroundImage,
                /*[data-background-container-id='${this.getId()}']*/ .teamapps-backgroundImage {
                    background-color: ${this.backgroundColor || ''};
                    background-image: ${this.backgroundImage ? `url(${this.backgroundImage})` : 'none'};
                }
                /*[data-background-container-id='${this.getId()}']*/.teamapps-blurredBackgroundImage,
                /*[data-background-container-id='${this.getId()}']*/ .teamapps-blurredBackgroundImage {
                    background-image: ${this.blurredBackgroundImage ? `url(${this.blurredBackgroundImage})` : 'none'};
                }
            `);
	}

	public static showWindow(uiWindow: UiWindow, animationDuration = 1000, context?: TeamAppsUiContext) {
		this.ALL_ROOT_PANELS.forEach(rootPanel => {
			rootPanel.childComponents.forEach(childComponent => {
				rootPanel.visibleChildComponent.$wrapper.css({
					transition: `opacity ${animationDuration}ms, filter ${animationDuration}ms`
				});
			});

		});

		uiWindow.getMainDomElement().appendTo(document.body);
		uiWindow.getMainDomElement().attr("data-background-container-id", this.ALL_ROOT_PANELS[0].getId());
		uiWindow.attachedToDom = true;
		uiWindow.setListener({
			onWindowClosed: (window, animationDuration) => this.closeWindow(window.getId(), animationDuration)
		});
		this.WINDOWS_BY_ID[uiWindow.getId()] = uiWindow;
		uiWindow.show(animationDuration);

		this.ALL_ROOT_PANELS.forEach(rootPanel => {
			rootPanel.getMainDomElement().toggleClass("modal-window-mode", uiWindow.isModal());
		});
	}

	public static closeWindow(windowId: string, animationDuration: number) {
		this.ALL_ROOT_PANELS.forEach(rootPanel => {
			rootPanel.getMainDomElement().removeClass('modal-window-mode');
		});

		let uiWindow = this.WINDOWS_BY_ID[windowId];
		uiWindow.hide(animationDuration);
		delete this.WINDOWS_BY_ID[windowId];

		setTimeout(() => {
			uiWindow.getMainDomElement().detach();
		}, animationDuration);
	};

	onResize() {
		if (this.visibleChildComponent) {
			this.visibleChildComponent.component.reLayout();
		}
	}

	protected onAttachedToDom() {
		this.childComponents.forEach(c => c.component.attachedToDom = true);
	}

	public destroy(): void {
		delete UiRootPanel.ALL_ROOT_PANELS_BY_ID[this.getId()];
		if (Object.keys(UiRootPanel.ALL_ROOT_PANELS_BY_ID).length === 0) {
			Object.keys(UiRootPanel.WINDOWS_BY_ID).forEach(windowId => UiRootPanel.WINDOWS_BY_ID[windowId].close(0));
		}
	}

	public static buildRootPanel(containerElementId: string, uiRootPanel: UiRootPanel, context?: TeamAppsUiContext): void {
		const $container = $(containerElementId ? "#" + containerElementId : document.body);
		uiRootPanel.getMainDomElement().appendTo($container);
		uiRootPanel.attachedToDom = true;
	}

	public static setThemeClassName(theme: string) {
		// remove other theme classes
		document.body.className = document.body.className.replace(/theme-\w+/, '');
		// add theme class
		if (theme) {
			document.body.classList.add(theme);
		}
	}

	public static showNotification(notification: UiNotificationConfig, context: TeamAppsUiContext) {
		showNotification(context.templateRegistry.createTemplateRenderer(notification.template).render(notification.data), notification);
	}

	public static downloadFile(fileUrl: string, fileName: string) {
		const link = document.createElement('a');
		link.href = fileUrl + (fileUrl.indexOf('?') === -1 ? '?' : '&') + 'teamapps-download-filename=' + fileName;
		(<any>link).download = fileName;
		if (document.createEvent) {
			const e = document.createEvent('MouseEvents');
			e.initEvent('click', true, true);
			link.dispatchEvent(e);
			return true;
		}
	}

	public static registerTemplate(name: string, template: UiTemplateConfig, context: TeamAppsUiContext) {
		context.templateRegistry.registerTemplate(name, template);
	}

	public static registerTemplates(templates: { [name: string]: UiTemplateConfig }, context: TeamAppsUiContext) {
		Object.keys(templates).forEach(templateName => {
			this.registerTemplate(templateName, templates[templateName], context);
		});
	}

	public static addClientToken(token: string) {
		let tokens = UiRootPanel.loadClientTokens();
		tokens[token] = true;
		UiRootPanel.saveClientTokens(tokens);
	}

	public static removeClientToken(token: string) {
		let tokens = UiRootPanel.loadClientTokens();
		delete tokens[token];
		UiRootPanel.saveClientTokens(tokens);
	}

	public static clearClientTokens() {
		UiRootPanel.saveClientTokens({});
	}

	private static loadClientTokens(): { [tokenName: string]: true } {
		let tokens: { [tokenName: string]: true } = {};
		let tokenJson = localStorage.getItem("clientTokens");
		if (tokenJson) {
			tokens = JSON.parse(tokenJson);
		}
		return tokens;
	}

	public static getClientTokens(): string[] {
		return Object.keys(UiRootPanel.loadClientTokens());
	}

	private static saveClientTokens(tokens: { [token: string]: true }) {
		localStorage.setItem("clientTokens", JSON.stringify(tokens));
	}

	public static exitFullScreen() {
		exitFullScreen();
	}

	public static showGenericErrorMessage(title: string, message: string, options: UiGenericErrorMessageOption[], context: TeamAppsUiContext): void {
		let uiWindow = new UiWindow({
			id: null,
			title: title,
			width: 330,
			height: 150,
			modalBackgroundDimmingColor: {red: 0, green: 0, blue: 0, alpha: .5},
			modal: true,
			content: null
		}, context);
		let $contentElement = $(`<div class="UiGenericErrorMessage">
	<div class="icon img img-48" style="background-image: url(/resources/window-close-grey.png)"></div>
	<div class="message">${message}</div>
	<div class="option-buttons">
		${options.map(o => `<div class="btn btn-default ${UiGenericErrorMessageOption[o].toLowerCase()}">${UiGenericErrorMessageOption[o]}</div>`).join("")}
	</div>
</div>`);
		uiWindow.setContent(new ElementUiComponentAdapter($contentElement));
		$contentElement.find('.ok').on('click', () => {
			uiWindow.close(500);
		});
		$contentElement.find('.reload').on('click', () => {
			window.location.reload(true);
		});
		UiRootPanel.showWindow(uiWindow, 500);
	}

	setOptimizedForTouch(optimizedForTouch: boolean) {
		this.$root.toggleClass("optimized-for-touch", optimizedForTouch);
		document.body.classList.toggle("optimized-for-touch", optimizedForTouch); // needed for popups and maximized panels... TODO either only use this or change implementation
	}
}

UiRootPanel.__initialize();

TeamAppsUiComponentRegistry.registerComponentClass("UiRootPanel", UiRootPanel);
