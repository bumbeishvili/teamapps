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
package org.teamapps.ux.component.itemview;

import org.teamapps.data.extract.BeanPropertyExtractor;
import org.teamapps.data.extract.PropertyExtractor;
import org.teamapps.dto.UiIdentifiableClientRecord;
import org.teamapps.dto.UiItemViewItemGroup;
import org.teamapps.ux.cache.CacheManipulationHandle;
import org.teamapps.ux.cache.ClientRecordCache;
import org.teamapps.ux.component.template.BaseTemplate;
import org.teamapps.ux.component.template.Template;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class ItemGroup<HEADERRECORD, RECORD> {

	private final String clientId = UUID.randomUUID().toString();

	private List<RECORD> items = new ArrayList<>();
	private Template itemTemplate;
	private HEADERRECORD headerRecord;

	private boolean headerVisible = true;
	private ItemViewFloatStyle floatStyle = ItemViewFloatStyle.HORIZONTAL_FLOAT;
	private ItemViewItemJustification itemJustification = ItemViewItemJustification.LEFT;
	private float buttonWidth = -1;
	private int horizontalPadding = 0;
	private int verticalPadding = 0;
	private int horizontalItemMargin = 0;
	private int verticalItemMargin = 0;

	private ItemGroupContainer<HEADERRECORD, RECORD> container;
	private PropertyExtractor<RECORD> itemPropertyExtractor = new BeanPropertyExtractor<>();
	private final ClientRecordCache<RECORD, UiIdentifiableClientRecord> itemCache = new ClientRecordCache<>(this::createUiIdentifiableClientRecord);

	public ItemGroup() {
		this(null);
	}

	public ItemGroup(HEADERRECORD headerRecord) {
		this(headerRecord, null);
	}

	public ItemGroup(HEADERRECORD headerRecord, Template itemTemplate) {
		this(headerRecord, itemTemplate, null);
	}

	public ItemGroup(HEADERRECORD headerRecord, Template itemTemplate, List<RECORD> items) {
		this.itemTemplate = itemTemplate == null ? BaseTemplate.ITEM_VIEW_ITEM : itemTemplate;
		this.headerRecord = headerRecord;
		this.items.addAll(items != null ? items : Collections.emptyList());
	}

	public UiItemViewItemGroup createUiItemViewItemGroup() {
		UiItemViewItemGroup itemGroup = new UiItemViewItemGroup(itemTemplate.createUiTemplate());
		itemGroup.setId(clientId);
		if (headerRecord != null) {
			itemGroup.setHeaderData(container.createHeaderClientRecord(headerRecord));
		}

		CacheManipulationHandle<List<UiIdentifiableClientRecord>> cacheResponse = itemCache.replaceRecords(this.items);
		cacheResponse.commit();
		itemGroup.setItems(cacheResponse.getResult());
		itemGroup.setHeaderVisible(headerVisible);
		itemGroup.setFloatStyle(floatStyle.toUiItemViewFloatStyle());
		itemGroup.setButtonWidth(buttonWidth);
		itemGroup.setHorizontalPadding(horizontalPadding);
		itemGroup.setVerticalPadding(verticalPadding);
		itemGroup.setHorizontalItemMargin(horizontalItemMargin);
		itemGroup.setVerticalItemMargin(verticalItemMargin);
		itemGroup.setItemJustification(itemJustification.toUiItemJustification());
		return itemGroup;
	}

	private UiIdentifiableClientRecord createUiIdentifiableClientRecord(RECORD record) {
		UiIdentifiableClientRecord clientRecord = new UiIdentifiableClientRecord();
		clientRecord.setValues(itemPropertyExtractor.getValues(record, itemTemplate.getDataKeys()));
		return clientRecord;
	}

	public void setContainer(ItemGroupContainer<HEADERRECORD, RECORD> container) {
		this.container = container;
	}

	public void addItem(RECORD item) {
		if (items.contains(item)) {
			return;
		}
		items.add(item);
		if (container != null) {
			CacheManipulationHandle<UiIdentifiableClientRecord> cacheResponse = itemCache.addRecord(item);
			container.handleAddItem(cacheResponse.getResult(), aVoid -> cacheResponse.commit());
		}
	}

	public void removeItem(RECORD item) {
		boolean removed = items.remove(item);
		if (removed) {
			CacheManipulationHandle<Integer> cacheResponse = itemCache.removeRecord(item);
			container.handleRemoveItem(cacheResponse.getResult(), aVoid -> cacheResponse.commit());
		}
	}

	public List<RECORD> getItems() {
		return items;
	}

	private void requireRefresh() {
		if (container != null) {
			container.handleRefreshRequired();
		}
	}

	public ItemGroup setItems(List<RECORD> items) {
		this.items = items;
		requireRefresh();
		return this;
	}

	public Template getItemTemplate() {
		return itemTemplate;
	}

	public ItemGroup setItemTemplate(Template itemTemplate) {
		this.itemTemplate = itemTemplate;
		requireRefresh();
		return this;
	}

	public HEADERRECORD getHeaderRecord() {
		return headerRecord;
	}

	public ItemGroup setHeaderRecord(HEADERRECORD headerRecord) {
		this.headerRecord = headerRecord;
		requireRefresh();
		return this;
	}

	public boolean isHeaderVisible() {
		return headerVisible;
	}

	public ItemGroup setHeaderVisible(boolean headerVisible) {
		this.headerVisible = headerVisible;
		requireRefresh();
		return this;
	}

	public ItemViewFloatStyle getFloatStyle() {
		return floatStyle;
	}

	public ItemGroup setFloatStyle(ItemViewFloatStyle floatStyle) {
		this.floatStyle = floatStyle;
		requireRefresh();
		return this;
	}

	public float getButtonWidth() {
		return buttonWidth;
	}

	public ItemGroup setButtonWidth(float buttonWidth) {
		this.buttonWidth = buttonWidth;
		requireRefresh();
		return this;
	}

	public int getHorizontalPadding() {
		return horizontalPadding;
	}

	public ItemGroup setHorizontalPadding(int horizontalPadding) {
		this.horizontalPadding = horizontalPadding;
		requireRefresh();
		return this;
	}

	public int getVerticalPadding() {
		return verticalPadding;
	}

	public ItemGroup setVerticalPadding(int verticalPadding) {
		this.verticalPadding = verticalPadding;
		requireRefresh();
		return this;
	}

	public int getHorizontalItemMargin() {
		return horizontalItemMargin;
	}

	public ItemGroup setHorizontalItemMargin(int horizontalItemMargin) {
		this.horizontalItemMargin = horizontalItemMargin;
		requireRefresh();
		return this;
	}

	public int getVerticalItemMargin() {
		return verticalItemMargin;
	}

	public ItemGroup setVerticalItemMargin(int verticalItemMargin) {
		this.verticalItemMargin = verticalItemMargin;
		requireRefresh();
		return this;
	}

	public ItemViewItemJustification getItemJustification() {
		return itemJustification;
	}

	public ItemGroup setItemJustification(ItemViewItemJustification itemJustification) {
		this.itemJustification = itemJustification;
		requireRefresh();
		return this;
	}

	public ItemGroupContainer<HEADERRECORD, RECORD> getContainer() {
		return container;
	}

	public PropertyExtractor<RECORD> getItemPropertyExtractor() {
		return itemPropertyExtractor;
	}

	public void setItemPropertyExtractor(PropertyExtractor<RECORD> itemPropertyExtractor) {
		this.itemPropertyExtractor = itemPropertyExtractor;
		requireRefresh();
	}

	/*package-private*/ RECORD getItemByClientId(int clientId) {
		return itemCache.getRecordByClientId(clientId);
	}

	/*package-private*/ String getClientId() {
		return clientId;
	}

}
