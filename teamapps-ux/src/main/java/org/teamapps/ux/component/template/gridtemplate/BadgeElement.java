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
package org.teamapps.ux.component.template.gridtemplate;

import org.teamapps.common.format.Color;
import org.teamapps.dto.AbstractUiTemplateElement;
import org.teamapps.dto.UiBadgeElement;
import org.teamapps.ux.component.format.*;

import static org.teamapps.util.UiUtil.createUiColor;

public class BadgeElement extends TextElement {

	private Color borderColor;

	public BadgeElement(String dataKey) {
		super(dataKey);
	}

	public BadgeElement(String dataKey, int row, int column) {
		super(dataKey, row, column);
	}

	public BadgeElement(String dataKey, int row, int column, int rowSpan, int colSpan) {
		super(dataKey, row, column, rowSpan, colSpan);
	}

	public BadgeElement(String dataKey, int row, int column, int rowSpan, int colSpan, HorizontalElementAlignment horizontalAlignment, VerticalElementAlignment verticalAlignment) {
		super(dataKey, row, column, rowSpan, colSpan, horizontalAlignment, verticalAlignment);
	}

	public BadgeElement setFontStyle(final FontStyle fontStyle) {
		this.fontStyle = fontStyle;
		return this;
	}

	public BadgeElement setLineHeight(final float lineHeight) {
		this.lineHeight = lineHeight;
		return this;
	}

	public BadgeElement setWrapLines(final boolean wrapLines) {
		this.wrapLines = wrapLines;
		return this;
	}

	public BadgeElement setPadding(final Spacing padding) {
		this.padding = padding;
		return this;
	}

	public BadgeElement setDataKey(final String dataKey) {
		this.dataKey = dataKey;
		return this;
	}

	@Override
	public AbstractUiTemplateElement createUiTemplateElement() {
		UiBadgeElement uiBadgeElement = new UiBadgeElement(dataKey, row, column);
		mapAbstractTemplateElementAttributesToUiElement(uiBadgeElement);
		mapTextElementAttributesToUiElement(uiBadgeElement);
		uiBadgeElement.setBorderColor(borderColor != null ? createUiColor(borderColor) : null);
		return uiBadgeElement;
	}

	public BadgeElement setRow(final int row) {
		this.row = row;
		return this;
	}

	public BadgeElement setColumn(final int column) {
		this.column = column;
		return this;
	}

	public BadgeElement setRowSpan(final int rowSpan) {
		this.rowSpan = rowSpan;
		return this;
	}

	public BadgeElement setColSpan(final int colSpan) {
		this.colSpan = colSpan;
		return this;
	}

	public BadgeElement setBorderColor(Color borderColor) {
		this.borderColor = borderColor;
		return this;
	}

	public Color getBorderColor() {
		return borderColor;
	}
}
