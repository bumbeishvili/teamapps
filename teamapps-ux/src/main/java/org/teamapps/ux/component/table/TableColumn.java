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
package org.teamapps.ux.component.table;

import org.teamapps.dto.UiTableColumn;
import org.teamapps.icons.api.Icon;
import org.teamapps.ux.component.field.AbstractField;
import org.teamapps.ux.component.field.FieldMessage;
import org.teamapps.ux.session.CurrentSessionContext;
import org.teamapps.ux.session.SessionContext;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class TableColumn {
	private Table table;

	private final String propertyName;
	private Icon icon;
	private String title;
	private AbstractField field;
	private int minWidth;
	private int defaultWidth;
	private int maxWidth;
	private boolean hidden;
	private boolean sortable = true;
	private boolean resizeable = true;
	boolean hiddenIfOnlyEmptyCellsVisible = false;

	private List<FieldMessage> messages = new ArrayList<>();

	public TableColumn(String propertyName, AbstractField field) {
		this(propertyName, null, null, field, 0, 150, 0);
	}

	public TableColumn(String propertyName, String title, AbstractField field) {
		this(propertyName, null, title, field, 0, 150, 0);
	}

	public TableColumn(String propertyName, Icon icon, String title, AbstractField field) {
		this(propertyName, icon, title, field, 0, 150, 0);
	}

	public TableColumn(String propertyName, Icon icon, String title, AbstractField field, int defaultWidth) {
		this(propertyName, icon, title, field, 0, defaultWidth, 0);
	}

	public TableColumn(String propertyName, Icon icon, String title, AbstractField field, int minWidth, int defaultWidth, int maxWidth) {
		this.propertyName = propertyName;
		this.icon = icon;
		this.title = title;
		this.field = field;
		this.minWidth = minWidth;
		this.defaultWidth = defaultWidth;
		this.maxWidth = maxWidth;
	}

	public UiTableColumn createUiTableColumn() {
		SessionContext context = CurrentSessionContext.get();
		UiTableColumn uiTableColumn = new UiTableColumn(propertyName, context.resolveIcon(icon), title, field.createUiComponentReference());
		uiTableColumn.setDefaultWidth(defaultWidth);
		uiTableColumn.setMinWidth(minWidth);
		uiTableColumn.setDefaultWidth(defaultWidth);
		uiTableColumn.setMaxWidth(maxWidth);
		uiTableColumn.setSortable(sortable);
		uiTableColumn.setResizeable(resizeable);
		uiTableColumn.setHiddenIfOnlyEmptyCellsVisible(hiddenIfOnlyEmptyCellsVisible);
		uiTableColumn.setMessages(messages.stream().map(fieldMessage -> fieldMessage.createUiFieldMessage()).collect(Collectors.toList()));
		return uiTableColumn;
	}

	public List<FieldMessage> getMessages() {
		return messages;
	}

	public void addMessage(FieldMessage message) {
		this.messages.add(message);
		if (table != null) {
			table.updateColumnMessages(this);
		}
	}

	public void removeMessage(FieldMessage message) {
		this.messages.remove(message);
		if (table != null) {
			table.updateColumnMessages(this);
		}
	}

	public void setMessages(List<FieldMessage> messages) {
		this.messages = messages;
		if (table != null) {
			table.updateColumnMessages(this);
		}
	}

	public Icon getIcon() {
		return icon;
	}

	public TableColumn setIcon(Icon icon) {
		this.icon = icon;
		return this;
	}

	public String getTitle() {
		return title;
	}

	public TableColumn setTitle(String title) {
		this.title = title;
		return this;
	}

	public AbstractField getField() {
		return field;
	}

	public TableColumn setField(AbstractField field) {
		this.field = field;
		return this;
	}

	public int getMinWidth() {
		return minWidth;
	}

	public TableColumn setMinWidth(int minWidth) {
		this.minWidth = minWidth;
		return this;
	}

	public int getDefaultWidth() {
		return defaultWidth;
	}

	public TableColumn setDefaultWidth(int defaultWidth) {
		this.defaultWidth = defaultWidth;
		return this;
	}

	public int getMaxWidth() {
		return maxWidth;
	}

	public TableColumn setMaxWidth(int maxWidth) {
		this.maxWidth = maxWidth;
		return this;
	}

	public boolean isHidden() {
		return hidden;
	}

	public TableColumn setHidden(boolean hidden) {
		this.hidden = hidden;
		return this;
	}

	public boolean isSortable() {
		return sortable;
	}

	public TableColumn setSortable(boolean sortable) {
		this.sortable = sortable;
		return this;
	}

	public boolean isResizeable() {
		return resizeable;
	}

	public TableColumn setResizeable(boolean resizeable) {
		this.resizeable = resizeable;
		return this;
	}

	public boolean isHiddenIfOnlyEmptyCellsVisible() {
		return hiddenIfOnlyEmptyCellsVisible;
	}

	public TableColumn setHiddenIfOnlyEmptyCellsVisible(boolean hiddenIfOnlyEmptyCellsVisible) {
		this.hiddenIfOnlyEmptyCellsVisible = hiddenIfOnlyEmptyCellsVisible;
		return this;
	}

	/*package-private*/ void setTable(Table table) {
		this.table = table;
	}

	public String getPropertyName() {
		return propertyName;
	}
}
