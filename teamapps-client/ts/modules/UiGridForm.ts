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
import {UiGridForm_SectionCollapsedStateChangedEvent, UiGridFormCommandHandler, UiGridFormConfig, UiGridFormEventSource} from "../generated/UiGridFormConfig";
import {UiFormLayoutPolicyConfig} from "../generated/UiFormLayoutPolicyConfig";
import {UiField} from "./formfield/UiField";
import {UiFormSectionConfig} from "../generated/UiFormSectionConfig";
import {UiComponent} from "./UiComponent";
import {TeamAppsUiContext} from "./TeamAppsUiContext";
import {executeWhenAttached} from "./util/ExecuteWhenAttached";
import {
	createCssGridRowOrColumnString,
	createUiBorderCssString,
	createUiColorCssString,
	createUiShadowCssString,
	createUiSpacingCssString,
	cssHorizontalAlignmentByUiVerticalAlignment,
	cssVerticalAlignmentByUiVerticalAlignment
} from "./util/CssFormatUtil";
import {TeamAppsEvent} from "./util/TeamAppsEvent";
import {EventFactory} from "../generated/EventFactory";
import {TeamAppsUiComponentRegistry} from "./TeamAppsUiComponentRegistry";
import * as log from "loglevel";
import {UiFormSectionFieldPlacementConfig} from "../generated/UiFormSectionFieldPlacementConfig";
import {UiFormSectionPlacementConfig} from "../generated/UiFormSectionPlacementConfig";
import {UiFormSectionFloatingFieldsPlacementConfig} from "../generated/UiFormSectionFloatingFieldsPlacementConfig";
import {generateUUID} from "./Common";
import {bind} from "./util/Bind";

export class UiGridForm extends UiComponent<UiGridFormConfig> implements UiGridFormCommandHandler, UiGridFormEventSource {

	public readonly onSectionCollapsedStateChanged: TeamAppsEvent<UiGridForm_SectionCollapsedStateChangedEvent> = new TeamAppsEvent<UiGridForm_SectionCollapsedStateChangedEvent>(this);

	private $mainDiv: any;

	private sections: UiFormSection[];

	private layoutPoliciesFromLargeToSmall: UiFormLayoutPolicyConfig[];
	private activeLayoutPolicyIndex: number;
	private uiFields: UiField[] = [];
	private fillRemainingHeightCheckerInterval: number;
	private sectionCollapseOverrides: { [sectionId: string]: boolean };

	constructor(config: UiGridFormConfig, context: TeamAppsUiContext) {
		super(config, context);
		this.$mainDiv = $(`<div class="UiGridForm" data-teamapps-id="${config.id}">
</div>`);

		config.fields.forEach(fieldConfig => this.addField(fieldConfig));
		this.updateLayoutPolicies(config.layoutPolicies);
	}

	private addField(uiField: UiField) {
		this.uiFields.push(uiField);
	}

	public getMainDomElement(): JQuery {
		return this.$mainDiv;
	}

	@executeWhenAttached(true)
	public onResize(): void {
		const newLayoutPolicyIndex = this.determineLayoutPolicyIndexToApply();
		if (newLayoutPolicyIndex !== this.activeLayoutPolicyIndex) {
			this.activeLayoutPolicyIndex = newLayoutPolicyIndex;
			this.applyLayoutPolicy(this.layoutPoliciesFromLargeToSmall[newLayoutPolicyIndex]);
		}
		this.uiFields.forEach(field => field.reLayout());
		this.ensureFillRemainingHeight();
	}

	private determineLayoutPolicyIndexToApply(): number {
		const availableWidth = this.getWidth();
		const policyIndex = this.layoutPoliciesFromLargeToSmall.findIndex(p => p.minWidth <= availableWidth);
		if (policyIndex === -1) {
			this.logger.warn(`No applicable layout policy found for width ${availableWidth}. Applying layout with the largest minWidth.`);
			return this.layoutPoliciesFromLargeToSmall.length - 1;
		}
		return policyIndex;
	}

	@executeWhenAttached(true)
	private applyLayoutPolicy(layoutPolicy: UiFormLayoutPolicyConfig) {
		this.uiFields.forEach(uiField => uiField.getMainDomElement().detach());
		this.sections && this.sections.forEach(section => {
			section.destroy();
			section.getMainDomElement().detach();
		});
		this.sections = layoutPolicy.sections.map(sectionConfig => {
			const section = new UiFormSection(sectionConfig, this._context, this.sectionCollapseOverrides[sectionConfig.id]);
			section.getMainDomElement().appendTo(this.$mainDiv);
			section.placeFields();
			section.onCollapsedStateChanged.addListener((collapsed) => {
				this.onSectionCollapsedStateChanged.fire(EventFactory.createUiGridForm_SectionCollapsedStateChangedEvent(this.getId(), sectionConfig.id, collapsed));
				this.sectionCollapseOverrides[sectionConfig.id] = collapsed;
			});
			return section;
		});
	}

	public setSectionCollapsed(sectionId: string, collapsed: boolean) {
		this.sectionCollapseOverrides[sectionId] = collapsed;
		this.sections.filter(s => s.config.id === sectionId).forEach(s => s.setCollapsed(collapsed));
	}

	@executeWhenAttached(true)
	public updateLayoutPolicies(layoutPolicies: UiFormLayoutPolicyConfig[]): void {
		this.sectionCollapseOverrides = {};
		this.layoutPoliciesFromLargeToSmall = layoutPolicies.sort((a, b) => b.minWidth - a.minWidth);
		this.activeLayoutPolicyIndex = this.determineLayoutPolicyIndexToApply();
		let layoutPolicyToApply = this.layoutPoliciesFromLargeToSmall[this.activeLayoutPolicyIndex];
		this.applyLayoutPolicy(layoutPolicyToApply);
	}

	protected onAttachedToDom(): void {
		if (this.fillRemainingHeightCheckerInterval == null) {
			this.fillRemainingHeightCheckerInterval = window.setInterval(() => {
				this.ensureFillRemainingHeight();
			}, 30000); // chose high delay here, since it makes the scrollbar appear for a few seconds on macos
		}
	}

	// This hack is needed because css grid does not fill the whole height of a section when as it grows (flex). This is because the height of the (flex) section is dynamic, and not a static value.
	private ensureFillRemainingHeight() {
		let scrollContainer = this.$mainDiv[0];
		while (scrollContainer.scrollTop === 0 && scrollContainer.parentElement != null) {
			scrollContainer = scrollContainer.parentElement;
		}
		let scrollBefore = scrollContainer.scrollTop;
		this.sections.forEach(section => section.config.fillRemainingHeight && section.updateBodyHeightToFillRemainingHeight());
		scrollContainer.scrollTop = scrollBefore;
	}

	public destroy(): void {
		window.clearInterval(this.fillRemainingHeightCheckerInterval);
	}

	addOrReplaceField(field: UiField): void {
		this.addField(field);
		this.applyLayoutPolicy(this.layoutPoliciesFromLargeToSmall[this.determineLayoutPolicyIndexToApply()]);
	}

}

class UiFormSection {

	private static readonly LOGGER = log.getLogger("UiFormSection");
	public readonly onCollapsedStateChanged: TeamAppsEvent<boolean> = new TeamAppsEvent<boolean>(this);

	private uiFields: UiField[] = [];

	private uuid: string;
	private $div: JQuery;
	private $placementStyles: JQuery;
	private $header: JQuery;
	private $headerTemplateContainer: JQuery;
	private $body: JQuery;
	private $expander: JQuery;
	private collapsed: boolean;

	constructor(public config: UiFormSectionConfig, context: TeamAppsUiContext, collapsedOverride: boolean) {
		this.uuid = generateUUID();
		
		const headerLineClass = config.drawHeaderLine ? 'draw-header-line' : '';
		const hasHeaderTemplateClass = config.headerTemplate ? 'has-header-template' : '';
		const hasHeaderDataClass = config.headerData ? 'has-header-data' : '';
		const collapsibleClass = config.collapsible ? 'collapsible' : '';
		const collapsedClass = this.collapsed ? 'collapsed' : '';
		const hiddenClass = config.visible ? '' : 'hidden'; // TODO discuss how the visible attribute will be handled when layout policies are updated. Does this attribute make sense at all?
		const fillRemainingHeightClass = config.fillRemainingHeight ? 'fill-remaining-height' : '';

		const marginCss = createUiSpacingCssString("margin", config.margin);
		const paddingCss = createUiSpacingCssString("padding", config.padding);
		const borderCss = createUiBorderCssString(config.border);
		const shadowCss = createUiShadowCssString(config.shadow);
		const backgroundColorCss = config.backgroundColor ? `background-color:${createUiColorCssString(config.backgroundColor)};` : '';

		const gridTemplateColumnsCss = 'grid-template-columns:' + config.columns.map(column => createCssGridRowOrColumnString(column.widthPolicy)).join(" ") + ';';
		const gridTemplateRowsCss = 'grid-template-rows:' + config.rows.map(row => createCssGridRowOrColumnString(row.heightPolicy)).join(" ") + ';';
		const gridGapCss = 'grid-gap:' + config.gridGap + 'px;';


		this.$div = $(`<div data-id="${config.id}" data-section-uuid="${this.uuid}" class="UiFormSection ${headerLineClass} ${hasHeaderTemplateClass} ${hasHeaderDataClass} ${collapsibleClass} ${hiddenClass} ${fillRemainingHeightClass}" style="${marginCss}${borderCss}${shadowCss}${backgroundColorCss}">
	<style></style>
    <div class="header">
        <div class="expand-button">
            <div class="teamapps-expander ${this.collapsed ? '' : 'expanded'} ${config.collapsible ? '' : 'hidden'}"/>
            <div class="header-template-container">
            </div>
        </div>
        <div class="header-line"/>
    </div>
    <div class="body" style="${paddingCss} ${gridTemplateColumnsCss} ${gridTemplateRowsCss} ${gridGapCss}">

	</div>
</div>`);
		this.$placementStyles = this.$div.find("style");
		this.$header = this.$div.find("> .header");
		this.$headerTemplateContainer = this.$header.find(".header-template-container");
		if (config.headerTemplate && config.headerData) {
			$(context.templateRegistry.createTemplateRenderer(config.headerTemplate).render(config.headerData)).appendTo(this.$headerTemplateContainer);
		}

		this.$expander = this.$div.find(".teamapps-expander");
		this.$div.find('.expand-button').click(() => {
			if (config.collapsible) {
				this.setCollapsed(!this.collapsed);
			}
		});

		this.$body = this.$div.find(".body");

		this.setCollapsed(collapsedOverride != null ? collapsedOverride : (config.collapsible && config.collapsed), false);
	}

	public placeFields() {
		let createSectionPlacementStyles: (placement: UiFormSectionPlacementConfig) => CssDeclarations = (placement: UiFormSectionPlacementConfig) => {
			return {
				"grid-column": `${placement.column + 1} / ${placement.column + placement.colSpan + 1}`,
				"grid-row": `${placement.row + 1} / ${placement.row + placement.rowSpan + 1}`,
				"justify-self": `${cssHorizontalAlignmentByUiVerticalAlignment[placement.horizontalAlignment]}`,
				"align-self": `${cssVerticalAlignmentByUiVerticalAlignment[placement.verticalAlignment]}`,
				"min-width": placement.minWidth ? `${placement.minWidth}px` : '',
				"max-width": placement.maxWidth ? `${placement.maxWidth}px` : '',
				"margin": `${this.config.rows[placement.row].topPadding}px ${this.config.columns[placement.column].rightPadding}px ${this.config.rows[placement.row].bottomPadding}px ${this.config.columns[placement.column].leftPadding}px`
			};
		};
		const allCssRules: { [fieldNameOrWrapperId: string]: CssDeclarations } = {};

		this.config.fieldPlacements.forEach(placement => {
			const placementId = generateUUID(true);
			if (this.isUiFormSectionFieldPlacement(placement)) {
				const uiField = placement.field;
				uiField.onVisibilityChanged.addListener(this.updateGroupVisibility);
				this.uiFields.push(uiField);
				allCssRules[placementId] = {
					...createSectionPlacementStyles(placement),
					"min-height": placement.minHeight ? `${placement.minHeight}px` : '',
					"max-height": placement.maxHeight ? `${placement.maxHeight}px` : ''
				};
				uiField.getMainDomElement()
					.attr("data-placement-id", placementId)
					.appendTo(this.$body);
				uiField.attachedToDom = true;
			} else if (this.isUiFormSectionFloatingFieldsPlacement(placement)) {
				let $container = $(`<div class="UiFormSectionFloatingFieldsPlacement" data-placement-id="${placementId}"></div>`);
				allCssRules[placementId] = {
					...createSectionPlacementStyles(placement),
					"flex-wrap": placement.wrap ? "wrap" : "nowrap"
				};
				placement.floatingFields.forEach(floatingField => {
					const uiField = floatingField.field;
					uiField.onVisibilityChanged.addListener(this.updateGroupVisibility);
					this.uiFields.push(uiField);
					const floatingFieldPlacementId = generateUUID(true);
					allCssRules[floatingFieldPlacementId] = {
						"min-width": floatingField.minWidth ? `${floatingField.minWidth}px` : '',
						"max-width": floatingField.maxWidth ? `${floatingField.maxWidth}px` : '',
						"min-height": floatingField.minHeight ? `${floatingField.minHeight}px` : '',
						"max-height": floatingField.maxHeight ? `${floatingField.maxHeight}px` : '',
						"margin": `${placement.verticalSpacing / 2}px ${placement.horizontalSpacing / 2}px`
					};
					uiField.getMainDomElement()
						.attr("data-placement-id", floatingFieldPlacementId)
						.appendTo($container);
					uiField.attachedToDom = true
				});
				$container.appendTo(this.$body);
			}
		});

		this.$placementStyles.text(this.createPlacementStylesCssString(allCssRules));
		this.updateGroupVisibility();
	}

	@bind
	private updateGroupVisibility() {
		let hasVisibleFields = this.uiFields.filter(uiField => uiField.isVisible()).length > 0;
		this.$div.toggleClass("hidden", !hasVisibleFields && this.config.hideWhenNoVisibleFields);
	}

	public destroy() {
		this.uiFields.forEach(f => f.onVisibilityChanged.removeListener(this.updateGroupVisibility));
	}

	createPlacementStylesCssString(cssRules: { [fieldNameOrWrapperId: string]: CssDeclarations }): string {
		return Object.keys(cssRules).map(placementId => {
			let cssRule = cssRules[placementId];
			let cssDeclarationsString = Object.keys(cssRule)
				.filter(cssProperty => !!cssRule[cssProperty])
				.map(cssProperty => `${cssProperty}: ${cssRule[cssProperty]}`).join(";\n");
			return `[data-section-uuid="${this.uuid}"] [data-placement-id="${placementId}"] {${cssDeclarationsString}}`;
		}).join('\n');
	}

	private isUiFormSectionFieldPlacement(placement: UiFormSectionPlacementConfig): placement is UiFormSectionFieldPlacementConfig {
		return placement._type === "UiFormSectionFieldPlacement";
	}

	private isUiFormSectionFloatingFieldsPlacement(placement: UiFormSectionPlacementConfig): placement is UiFormSectionFloatingFieldsPlacementConfig {
		return placement._type === "UiFormSectionFloatingFieldsPlacement";
	}

	public getMainDomElement(): JQuery {
		return this.$div;
	}

	updateBodyHeightToFillRemainingHeight() {
		this.$body[0].style.position = "absolute";
		this.$body[0].style.minHeight = (this.$div.innerHeight() - this.$header[0].offsetHeight) + "px";
		this.$body[0].style.position = "";
	}

	setCollapsed(collapsed: boolean, animate = true): void {
		this.collapsed = collapsed;
		this.onCollapsedStateChanged.fire(this.collapsed);
		this.$expander.toggleClass("expanded", !this.collapsed);
		this.$div.toggleClass("collapsed", this.collapsed);
		if (animate) {
			if (!this.collapsed) {
				this.$body.slideDown(200);
			} else {
				this.$body.slideUp(200);
			}
		} else {
			this.$body.toggle(!collapsed);
		}
		if (!collapsed) {
			this.uiFields.forEach(field => field.reLayout())
		}
	}
}

class CssDeclarations {
	[name: string]: string;
}

TeamAppsUiComponentRegistry.registerComponentClass("UiGridForm", UiGridForm);
