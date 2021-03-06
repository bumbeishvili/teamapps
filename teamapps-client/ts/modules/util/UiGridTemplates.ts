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
import {Renderer, RenderingFunction} from "../Common";
import {
	createCssGridRowOrColumnString,
	createImageSizingCssObject,
	createTextAlignmentCssString,
	createUiBorderCssString,
	createUiColorCssString,
	createUiFontStyleCssString,
	createUiShadowCssString,
	createUiSpacingCssString,
	cssHorizontalAlignmentByUiVerticalAlignment,
	cssObjectToString,
	cssVerticalAlignmentByUiVerticalAlignment
} from "./CssFormatUtil";
import {IconPathProvider} from "../TeamAppsUiContext";
import * as log from "loglevel";
import {UiTextElementConfig} from "../../generated/UiTextElementConfig";
import {UiBadgeElementConfig} from "../../generated/UiBadgeElementConfig";
import {UiFloatingElementConfig} from "../../generated/UiFloatingElementConfig";
import {UiImageElementConfig} from "../../generated/UiImageElementConfig";
import {UiIconElementConfig} from "../../generated/UiIconElementConfig";
import {UiGlyphIconElementConfig} from "../../generated/UiGlyphIconElementConfig";
import {AbstractUiTemplateElementConfig} from "../../generated/AbstractUiTemplateElementConfig";
import {UiGridTemplateConfig} from "../../generated/UiGridTemplateConfig";

function createTextElementRenderer(element: UiTextElementConfig, additionalCssClass?: string, additionalStyles?: string): RenderingFunction {
	const fontStyleCssString = createUiFontStyleCssString(element.fontStyle);
	const elementStyleCssString = (element.lineHeight ? ('line-height:' + element.lineHeight + ';') : '')
		+ (`white-space:${element.wrapLines ? 'normal' : 'nowrap'};`)
		+ (createUiSpacingCssString("padding", element.padding))
		+ (createTextAlignmentCssString(element.textAlignment));
	const backgroundColorCss = element.backgroundColor ? (`background-color: ${createUiColorCssString(element.backgroundColor)};`) : '';
	return (data: any) => {
		let value = data[element.dataKey];
		if (value == null) {
			return "";
		} else if (element.fontStyle != null && element.fontStyle.backgroundColor) {
			return `<div class="grid-template-element UiTextElement wrapper ${additionalCssClass || ''}" style="${elementStyleCssString} ${backgroundColorCss} ${additionalStyles || ''}">
	<span data-key="${element.dataKey}" style="${fontStyleCssString}">${value || ''}</span>
</div>`;
		} else {
			return `<span data-key="${element.dataKey}" class="grid-template-element UiTextElement ${additionalCssClass || ''}" style="${fontStyleCssString} ${elementStyleCssString} ${backgroundColorCss} ${additionalStyles || ''}">${value || ''}</span>`;
		}
	};
}

function createBadgeElementRenderer(element: UiBadgeElementConfig, additionalCss: string): RenderingFunction {
	const borderStyle = `border: 1px solid ${element.borderColor ? createUiColorCssString(element.borderColor) : 'transparent'};`;
	return createTextElementRenderer(element, 'UiBadgeElement', borderStyle + additionalCss);
}

function createFloatingElementRenderer(element: UiFloatingElementConfig, iconPathProvider: IconPathProvider, additionalCss: string): RenderingFunction {
	const elementRenderers = element.elements.map(subElement => createElementRenderer(subElement, iconPathProvider));
	const wrapCss = `flex-wrap: ${element.wrap ? 'wrap' : 'nowrap'};`;
	const backgroundColorCss = element.backgroundColor ? (`background-color: ${createUiColorCssString(element.backgroundColor)};`) : '';
	return (data: any) => {
		return `<div class='grid-template-element UiFloatingElement' style="${wrapCss} ${backgroundColorCss} ${additionalCss}">${elementRenderers.map(renderer => renderer(data)).join('')}</div>`;
	};
}

function createImageElementRenderer(element: UiImageElementConfig, additionalCss: string): RenderingFunction {
	let style = (element.width ? ('width:' + element.width + 'px;') : '')
		+ (element.height ? ('height:' + element.height + 'px;') : '')
		+ createUiBorderCssString(element.border)
		+ createUiSpacingCssString("padding", element.padding)
		+ createUiShadowCssString(element.shadow)
		+ cssObjectToString(createImageSizingCssObject(element.imageSizing))
		+ (element.backgroundColor ? (`background-color: ${createUiColorCssString(element.backgroundColor)};`) : '');
	return (data: any) => {
		let value = data[element.dataKey];
		if (value != null) {
			const backgroundImage = `background-image: url('${value}');`;
			return `<div data-key="${element.dataKey}" class="grid-template-element UiImageElement" style="${style} ${backgroundImage} ${additionalCss}"></div>`;
		} else {
			return '';
		}
	};
}

function createIconElementRenderer(element: UiIconElementConfig, iconPathProvider: IconPathProvider, additionalCss: string): RenderingFunction {
	const style = `width:${element.size}px; height:${element.size}px; background-size:${element.size}px;`;
	const backgroundColorCss = element.backgroundColor ? (`background-color: ${createUiColorCssString(element.backgroundColor)};`) : '';
	return (data: any) => {
		let value = data[element.dataKey];
		if (value != null) {
			let iconPath = iconPathProvider.getIconPath(value, element.size);
			const backgroundImage = iconPath ? `background-image: url('${iconPath}');` : '';
			return `<div data-key="${element.dataKey}" class="grid-template-element UiIconElement" style="${style} ${backgroundImage} ${backgroundColorCss} ${additionalCss}"></div>`;
		} else {
			return '';
		}
	};
}

function createGlyphIconElementRenderer(element: UiGlyphIconElementConfig, additionalCss: string): RenderingFunction {
	const style = `font-size:${element.size}px; text-align: center;`;
	const backgroundColorCss = element.backgroundColor ? (`background-color: ${createUiColorCssString(element.backgroundColor)};`) : '';
	return (data: any) => {
		let value = data[element.dataKey];
		if (value == null) {
			return "";
		} else {
			return `<div data-key="${element.dataKey}" class="grid-template-element UiGlyphIconElement fas fa-${value}" style="${style} ${backgroundColorCss} ${additionalCss}')"></div>`;
		}
	};
}

function createElementRenderer(element: AbstractUiTemplateElementConfig, iconPathProvider: IconPathProvider, additionalCss = ""): RenderingFunction {
	const column = `grid-column: ${element.column + 1} / ${element.column + element.colSpan + 1};`;
	const row = `grid-row: ${element.row + 1} / ${element.row + element.rowSpan + 1};`;
	const horizontalAlignmentCss = `justify-self: ${cssHorizontalAlignmentByUiVerticalAlignment[element.horizontalAlignment]};`;
	const verticalAlignmentCss = `align-self: ${cssVerticalAlignmentByUiVerticalAlignment[element.verticalAlignment]};`;

	let totalCss = additionalCss + column + row + horizontalAlignmentCss + verticalAlignmentCss;

	if (isUiTextElement(element)) {
		return createTextElementRenderer(element, null, totalCss);
	} else if (isUiBadgeElement(element)) {
		return createBadgeElementRenderer(element, totalCss);
	} else if (isUiFloatingElement(element)) {
		return createFloatingElementRenderer(element, iconPathProvider, totalCss);
	} else if (isUiImageElement(element)) {
		return createImageElementRenderer(element, totalCss);
	} else if (isUiIconElement(element)) {
		return createIconElementRenderer(element, iconPathProvider, totalCss);
	} else if (isUiGlyphIconElement(element)) {
		return createGlyphIconElementRenderer(element, totalCss);
	}
}

export function isUiTextElement(element: AbstractUiTemplateElementConfig): element is UiTextElementConfig {
	return element._type === "UiTextElement";
}

export function isUiBadgeElement(element: AbstractUiTemplateElementConfig): element is UiBadgeElementConfig {
	return element._type === "UiBadgeElement";
}

export function isUiFloatingElement(element: AbstractUiTemplateElementConfig): element is UiFloatingElementConfig {
	return element._type === "UiFloatingElement";
}

export function isUiImageElement(element: AbstractUiTemplateElementConfig): element is UiImageElementConfig {
	return element._type === "UiImageElement";
}

export function isUiIconElement(element: AbstractUiTemplateElementConfig): element is UiIconElementConfig {
	return element._type === "UiIconElement";
}

export function isUiGlyphIconElement(element: AbstractUiTemplateElementConfig): element is UiGlyphIconElementConfig {
	return element._type === "UiGlyphIconElement";
}

export function createGridTemplateRenderer(template: UiGridTemplateConfig, iconPathProvider: IconPathProvider, idPropertyName: string): Renderer {
	const renderers = template.elements.map(element => {

		let startColumn = template.columns[element.column];
		let endColumn = template.columns[element.column + element.colSpan - 1];
		let startRow = template.rows[element.row];
		let endRow = template.rows[element.row + element.rowSpan - 1];

		let marginCss: string;
		if (startColumn == null || endColumn == null || startRow == null || endRow == null) {
			log.getLogger("UiGridTemplate").error(`Element is placed (or spans) out of defined rows: col:${element.column};span:${element.colSpan}, row:${element.row};span:${element.rowSpan}.
			The resulting template renderer will skip some formattings for this element!`);
		} else {
			let marginTop = (element.margin && element.margin.top || 0) + (startRow.topPadding || 0);
			let marginRight = (element.margin && element.margin.right || 0) + (endColumn.rightPadding || 0);
			let marginBottom = (element.margin && element.margin.bottom || 0) + (endRow.bottomPadding || 0);
			let marginLeft = (element.margin && element.margin.left || 0) + (startColumn.leftPadding || 0);
			marginCss = `margin: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;`;
		}

		// TODO handle element's own padding!!!

		return createElementRenderer(element, iconPathProvider, marginCss);
	});

	const gridTemplateColumnsString = 'grid-template-columns:' + template.columns.map(column => createCssGridRowOrColumnString(column.widthPolicy)).join(" ") + ';';
	const gridTemplateRowsString = 'grid-template-rows:' + template.rows.map(row => createCssGridRowOrColumnString(row.heightPolicy)).join(" ") + ';';
	const paddingCss = createUiSpacingCssString("padding", template.padding);
	const gridGapCss = 'grid-gap:' + template.gridGap + 'px;';
	const maxWidthCss = template.maxWidth ? `max-width: ${template.maxWidth}px;` : '';
	const maxHeightCss = template.maxHeight ? `max-height: ${template.maxHeight}px;` : '';
	const gridCss = `${gridTemplateColumnsString} ${gridTemplateRowsString} ${paddingCss} ${gridGapCss} ${maxWidthCss} ${maxHeightCss}`;

	return {
		render: (data: any) => {
			if (data == null) {
				return '';
			} else {
				return `<div class="UiGridTemplate" style="${gridCss}" ${data[idPropertyName] ? `data-id="${data[idPropertyName]}"` : ''}>
	${renderers.map(renderer => renderer(data)).join("")}
</div>`;
			}
		},
		template
	};
}
