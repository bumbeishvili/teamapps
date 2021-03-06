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
import * as log from "loglevel";
import {isEmptyable} from "../util/Emptyable";
import {UiRelativeWorkSpaceViewPosition} from "../../generated/UiRelativeWorkSpaceViewPosition";
import {UiPanel} from "../UiPanel";
import {UiWorkSpaceLayoutViewConfig} from "../../generated/UiWorkSpaceLayoutViewConfig";
import {UiComponentConfig} from "../../generated/UiComponentConfig";
import {UiWorkSpaceLayout, UiWorkspaceLayoutDndDataTransfer} from "./UiWorkSpaceLayout";
import * as $ from "jquery";
import {UiSplitDirection} from "../../generated/UiSplitDirection";
import {UiSplitSizePolicy} from "../../generated/UiSplitSizePolicy";
import {generateUUID, getMicrosoftBrowserVersion} from "../Common";
import {bind} from "../util/Bind";
import {UiComponent} from "../UiComponent";
import {UiToolbar} from "../tool-container/toolbar/UiToolbar";
import {createUiWorkSpaceLayoutSplitItemConfig} from "../../generated/UiWorkSpaceLayoutSplitItemConfig";
import {UiWorkSpaceLayoutItemConfig} from "../../generated/UiWorkSpaceLayoutItemConfig";
import {createUiWorkSpaceLayoutViewGroupItemConfig, UiWorkSpaceLayoutViewGroupItemConfig} from "../../generated/UiWorkSpaceLayoutViewGroupItemConfig";
import {EventFactory} from "../../generated/EventFactory";
import {TeamAppsUiContext} from "../TeamAppsUiContext";
import {SplitPaneItem} from "./SplitPaneItem";
import {View} from "./View";
import {ItemTree, ItemTreeItem} from "./ItemTree";
import {TabPanelItem} from "./TabPanelItem";
import {ViewContainer, ViewContainerListener} from "./ViewContainer";
import {RelativeDropPosition} from "./RelativeDropPosition";
import {WindowLayoutDescriptor} from "./WindowLayoutDescriptor";
import {LayoutDescriptorApplyer} from "./LayoutDescriptorApplyer";
import {UiViewGroupPanelState} from "../../generated/UiViewGroupPanelState";

export class LocalViewContainer implements ViewContainer {

	private static logger: log.Logger = log.getLogger("LocalViewContainer");
	private static DND_MIME_TYPE: string = getMicrosoftBrowserVersion() ? 'text' : 'teamapps/uiworkspaceview';

	private itemTree = new ItemTree();
	private _toolbar: UiToolbar;

	private $mainDiv: JQuery;
	private $toolbarContainer: JQuery;
	private $contentContainer: JQuery;
	private $dndActiveRectangle: JQuery;
	private $dndImage: JQuery;
	private lastDndEventType: string;
	private _attachedToDom: boolean = false;

	private $maximizationContainerWrapper: JQuery;
	private $maximizationContainer: JQuery;
	private $normalContainerOfMaximizedTabPanel: JQuery;
	private $minimizedViewsBar: JQuery;
	private viewEventsSuppressed: boolean;

	constructor(private workSpaceLayout: UiWorkSpaceLayout,
	            public readonly windowId: string,
	            viewConfigs: UiWorkSpaceLayoutViewConfig[],
	            initialLayout: UiWorkSpaceLayoutItemConfig,
	            private context: TeamAppsUiContext,
	            private listener: ViewContainerListener) {
		this.$mainDiv = $(`<div data-id="${this.workSpaceLayoutId}" class="UiWorkSpaceLayout">
    <div class="toolbar-container"></div>
    <div class="content-container-wrapper">
	    <div class="content-container"></div>
		<div class="dnd-target-rectangle"></div>
		<div class="dnd-drag-image"></div>
	</div>
	<div class="minimized-tabpanel-bar"></div>
</div>`);

		this.$toolbarContainer = this.$mainDiv.find('.toolbar-container');
		this.$contentContainer = this.$mainDiv.find('.content-container');
		this.$dndActiveRectangle = this.$mainDiv.find('.dnd-target-rectangle');
		this.$dndImage = this.$mainDiv.find('.dnd-drag-image');
		this.$minimizedViewsBar = this.$mainDiv.find('.minimized-tabpanel-bar');

		this.$maximizationContainerWrapper = $(`<div class="UiWorkSpaceLayout-maximization-container-wrapper"><div class="UiWorkSpaceLayout-maximization-container"></div></div>`).appendTo(document.body);
		this.$maximizationContainer = this.$maximizationContainerWrapper.find('.UiWorkSpaceLayout-maximization-container');

		if (initialLayout) {
			this.redefineLayout(initialLayout, viewConfigs);
		} else {
			// initialLayout will be null for child windows
			this.setRootItem(this.createTabPanelItem({id: generateUUID(), viewNames: []}, null));
			return this;
		}
		this.fireViewNeedsRefreshForAllEmptyVisibleLazyTabs();

		let srcTabPanel = null;

		this.$mainDiv[0].addEventListener('dragstart', (e) => {
			this.lastDndEventType = 'dragstart';

			let target = e.target as HTMLElement;

			const matchingTabPanel = this.findParentTabPanel(target);

			if (matchingTabPanel) {
				let viewName = this.getViewNameForDragTarget(target);
				if (viewName) {
					let view = this.itemTree.getViewByName(viewName);
					srcTabPanel = matchingTabPanel;
					try {
						let $tabButton = matchingTabPanel.component.getMainDomElement().find(`.tab-button[data-tab-name=${viewName}]`)[0];
						if ($tabButton) {
							this.$dndImage[0].innerHTML = $tabButton.outerHTML;
							this.$dndImage.find('.tab-button').removeClass('hidden');
							e.dataTransfer.setDragImage(this.$dndImage[0], 0, 0);
						}
					} catch (e) {
						// microsoft browsers do not support this...
					}
					e.dataTransfer.effectAllowed = 'move';
					let data: UiWorkspaceLayoutDndDataTransfer = {
						sourceUiSessionId: this.context.sessionId,
						sourceWorkspaceLayoutId: this.workSpaceLayoutId,
						sourceWindowId: this.windowId,
						viewName: viewName,
						tabIcon: view.tabIcon,
						tabCaption: view.tabCaption,
						tabCloseable: view.tabCloseable,
						lazyLoading: view.lazyLoading,
						visible: view.visible
					};
					e.dataTransfer.setData(LocalViewContainer.DND_MIME_TYPE, JSON.stringify(data));
				}
			}
		});
		this.$mainDiv[0].addEventListener('dragenter', (e) => {
			this.lastDndEventType = 'dragenter';
		});
		this.$mainDiv[0].addEventListener('dragover', (e) => {
			this.lastDndEventType = 'dragover';

			if (e.dataTransfer != null && e.dataTransfer.types != null && !e.dataTransfer.types.includes(LocalViewContainer.DND_MIME_TYPE)) {
				return; // detected wrong mime type
			}

			let dropPosition = this.determineDropPosition(e);

			if (dropPosition) {
				e.dataTransfer.dropEffect = 'move';
				this.$dndActiveRectangle.show();

				if (dropPosition.tabPanel) {
					let $tabPanelContentWrapper = dropPosition.tabPanel.component.getMainDomElement().find('.tabpanel-content-wrapper');
					let tabPanelContentRect = $tabPanelContentWrapper[0].getBoundingClientRect();

					if (dropPosition.relativeDropPosition === RelativeDropPosition.TAB) {
						this.$dndActiveRectangle.position({
							my: "left top",
							at: "left top",
							of: $tabPanelContentWrapper
						});
						this.$dndActiveRectangle.css({width: tabPanelContentRect.width, height: tabPanelContentRect.height});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.LEFT) {
						this.$dndActiveRectangle.position({
							my: "left top",
							at: "left top",
							of: $tabPanelContentWrapper
						});
						this.$dndActiveRectangle.css({width: tabPanelContentRect.width / 2, height: tabPanelContentRect.height});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.RIGHT) {
						this.$dndActiveRectangle.position({
							my: "right top",
							at: "right top",
							of: $tabPanelContentWrapper
						});
						this.$dndActiveRectangle.css({width: tabPanelContentRect.width / 2, height: tabPanelContentRect.height});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.TOP) {
						this.$dndActiveRectangle.position({
							my: "left top",
							at: "left top",
							of: $tabPanelContentWrapper
						});
						this.$dndActiveRectangle.css({width: tabPanelContentRect.width, height: tabPanelContentRect.height / 2});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.BOTTOM) {
						this.$dndActiveRectangle.position({
							my: "left bottom",
							at: "left bottom",
							of: $tabPanelContentWrapper
						});
						this.$dndActiveRectangle.css({width: tabPanelContentRect.width, height: tabPanelContentRect.height / 2});
					}
				} else {
					let $workSpaceLayout = this.$contentContainer;
					let workSpaceLayoutRect = $workSpaceLayout[0].getBoundingClientRect();

					if (dropPosition.relativeDropPosition === RelativeDropPosition.LEFT) {
						this.$dndActiveRectangle.position({
							my: "left top",
							at: "left top",
							of: $workSpaceLayout
						});
						this.$dndActiveRectangle.css({width: workSpaceLayoutRect.width / 3, height: workSpaceLayoutRect.height});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.RIGHT) {
						this.$dndActiveRectangle.position({
							my: "right top",
							at: "right top",
							of: $workSpaceLayout
						});
						this.$dndActiveRectangle.css({width: workSpaceLayoutRect.width / 3, height: workSpaceLayoutRect.height});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.TOP) {
						this.$dndActiveRectangle.position({
							my: "left top",
							at: "left top",
							of: $workSpaceLayout
						});
						this.$dndActiveRectangle.css({width: workSpaceLayoutRect.width, height: workSpaceLayoutRect.height / 3});
					} else if (dropPosition.relativeDropPosition === RelativeDropPosition.BOTTOM) {
						this.$dndActiveRectangle.position({
							my: "left bottom",
							at: "left bottom",
							of: $workSpaceLayout
						});
						this.$dndActiveRectangle.css({width: workSpaceLayoutRect.width, height: workSpaceLayoutRect.height / 3});
					}
				}


			} else {
				this.$dndActiveRectangle.hide();
			}

			if (e.preventDefault) {
				e.preventDefault(); // Necessary. Allows us to drop.
			}
			return false;
		});
		this.$mainDiv[0].addEventListener('dragleave', (e) => {
			this.lastDndEventType = 'dragleave';
			this.$dndActiveRectangle.hide();
		});
		this.$mainDiv[0].addEventListener('drop', (e) => {
			this.$dndActiveRectangle.hide();

			let dropPosition = this.determineDropPosition(e);
			let dataTransferString = e.dataTransfer.getData(LocalViewContainer.DND_MIME_TYPE);
			if (dropPosition && dataTransferString != null) {
				let dataTransfer = JSON.parse(dataTransferString) as UiWorkspaceLayoutDndDataTransfer;
				if (this.context.sessionId === dataTransfer.sourceUiSessionId && dataTransfer.sourceWorkspaceLayoutId === this.workSpaceLayoutId) {
					if (dataTransfer.sourceWindowId === this.windowId) {
						if (dropPosition.tabPanel) {
							if (dropPosition.relativeDropPosition === RelativeDropPosition.TAB) {
								this.moveViewToTab(dataTransfer.viewName, dropPosition.tabPanel.tabs[0].viewName);
							} else {
								let uiRelativeWorkSpaceViewPosition = UiRelativeWorkSpaceViewPosition[RelativeDropPosition[dropPosition.relativeDropPosition] as keyof typeof UiRelativeWorkSpaceViewPosition];
								this.moveViewRelativeToOtherView(dataTransfer.viewName, dropPosition.tabPanel.tabs[0].viewName, uiRelativeWorkSpaceViewPosition, UiSplitSizePolicy.RELATIVE, .5);
							}
						} else {
							let uiRelativeWorkSpaceViewPosition = UiRelativeWorkSpaceViewPosition[RelativeDropPosition[dropPosition.relativeDropPosition] as keyof typeof UiRelativeWorkSpaceViewPosition];
							let isFirst = dropPosition.relativeDropPosition === RelativeDropPosition.LEFT || dropPosition.relativeDropPosition === RelativeDropPosition.TOP;
							this.moveViewToTopLevel(dataTransfer.viewName, this.windowId, uiRelativeWorkSpaceViewPosition, UiSplitSizePolicy.RELATIVE, isFirst ? .3 : .7);
						}
						this.listener.handleLocalLayoutChangedByUser(this.windowId);
					} else {
						if (this.workSpaceLayoutId === dataTransfer.sourceWorkspaceLayoutId) {
							this.listener.handleViewDroppedFromOtherWindow(dataTransfer.sourceWindowId, this.windowId, {
								viewName: dataTransfer.viewName,
								tabIcon: dataTransfer.tabIcon,
								tabCaption: dataTransfer.tabCaption,
								tabCloseable: dataTransfer.tabCloseable,
								lazyLoading: dataTransfer.lazyLoading,
								visible: dataTransfer.visible
							}, dropPosition.tabPanel && dropPosition.tabPanel.tabs[0].viewName, dropPosition.relativeDropPosition);
						}
					}
				} else {
					LocalViewContainer.logger.warn("The user dropped a view from another UiWorkSpaceLayout. Not accepting this.");
					return true;
				}
				return false;
			}
		}, false);
		this.$mainDiv[0].addEventListener('dragend', (e: DragEvent) => {
			this.$dndActiveRectangle.hide();
			const dropEffect = e.dataTransfer.dropEffect;
			const target = e.target as HTMLElement;
			const viewName = this.getViewNameForDragTarget(target);
			const dropSuccessful = dropEffect === 'move';
			let droppedOutsideWorkSpaceLayout = this.lastDndEventType === 'dragleave';
			if (droppedOutsideWorkSpaceLayout && !dropSuccessful) {
				this.createSubWindow(viewName);
			} else if (droppedOutsideWorkSpaceLayout && dropSuccessful) {
				// The other window will request a view refresh. This component will intercept it and register the windowDelegate...
			} else {
				// Nothing to do. The move is made in the 'drop' handler.
			}
			this.lastDndEventType = 'dragend';
		}, false);
	}

	private get workSpaceLayoutId() {
		return this.workSpaceLayout.getId();
	}

	public setToolbar(toolbar: UiToolbar): void {
		if (this._toolbar) {
			this.$toolbarContainer[0].innerHTML = '';
		}
		this._toolbar = toolbar;
		if (toolbar) {
			this._toolbar.getMainDomElement().appendTo(this.$toolbarContainer);
			this._toolbar.attachedToDom = this.attachedToDom;
			this._toolbar.onEmptyStateChanged.addListener(() => this.updateToolbarVisibility());
		}
		this.updateToolbarVisibility();
	}

	private updateToolbarVisibility() {
		this.$toolbarContainer.toggleClass('hidden', this._toolbar == null || this._toolbar.empty);
		if (this._toolbar) {
			this._toolbar.reLayout();
		}
	}

	public getViewInfo(viewName: string) {
		return this.itemTree.getViewByName(viewName).viewInfo;
	}

	get viewNames() {
		return this.itemTree.viewNames;
	}

	private createSubWindow(viewName: string | null) {
		let childWindowId = generateUUID();
		let childWindow = window.open("index.html" + (location.search ? location.search + "&" : "?") + "teamAppsContext=UiWorkSpaceLayoutChildWindowTeamAppsUiContext", childWindowId, "height=600,width=800,location=0");

		if (!childWindow || childWindow.closed || typeof childWindow.closed === 'undefined') {
			LocalViewContainer.logger.warn("Popup window was blocked.");
			this.listener.handleChildWindowCreationFailed(viewName);
		} else {
			let onWindowLoaded = () => {
				const channel = new MessageChannel();

				childWindow.postMessage("", location.origin, [channel.port2]);

				this.listener.handleChildWindowCreated(childWindowId, channel.port1, this.itemTree.getViewByName(viewName).viewInfo);
			};

			if (getMicrosoftBrowserVersion()) {
				// IE and Edge only return from the window.open() method _after_ the page has been loaded
				onWindowLoaded();
			} else {
				childWindow.addEventListener('load', () => {
					onWindowLoaded();
				});
			}
		}
	}

	private getViewNameForDragTarget(target: HTMLElement) {
		let viewName: string | null;
		let isDraggablePanelHeadingElement = UiPanel.isDraggablePanelHeadingElement(target);
		if (isDraggablePanelHeadingElement) {
			viewName = target.closest('.tab-content-wrapper').getAttribute('data-tab-name');
		}
		let isTabButton = target.classList.contains('tab-button');
		if (isTabButton) {
			viewName = target.getAttribute('data-tab-name');
		}
		return viewName;
	}

	private determineDropPosition(e: MouseEvent): { tabPanel?: TabPanelItem, relativeDropPosition: RelativeDropPosition } {
		let workSpaceLayoutRect = this.$contentContainer[0].getBoundingClientRect();

		if (e.pageY - workSpaceLayoutRect.top < 12) {
			return {relativeDropPosition: RelativeDropPosition.TOP};
		} else if ((workSpaceLayoutRect.left + workSpaceLayoutRect.width) - e.pageX < 12) {
			return {relativeDropPosition: RelativeDropPosition.RIGHT};
		} else if ((workSpaceLayoutRect.top + workSpaceLayoutRect.height) - e.pageY < 12) {
			return {relativeDropPosition: RelativeDropPosition.BOTTOM};
		} else if (e.pageX - workSpaceLayoutRect.left < 12) {
			return {relativeDropPosition: RelativeDropPosition.LEFT};
		}

		const matchingTabPanel = this.findParentTabPanel(e.target as HTMLElement);

		if (matchingTabPanel != null) {
			let view = matchingTabPanel.tabs[0];
			let tabPanelContentWrapper = matchingTabPanel.component.getMainDomElement().find('.tabpanel-content-wrapper');
			let tabPanelContentRect = tabPanelContentWrapper[0].getBoundingClientRect();
			const relativeEventX = (e.pageX - tabPanelContentRect.left) / tabPanelContentRect.width;
			const relativeEventY = (e.pageY - tabPanelContentRect.top) / tabPanelContentRect.height;

			if (relativeEventY < 0 || e.pageY - tabPanelContentRect.top < 30) {
				return {tabPanel: matchingTabPanel, relativeDropPosition: RelativeDropPosition.TAB};
			} else if (relativeEventX > 0.2 && relativeEventX < 0.8 && relativeEventY > 0.2 && relativeEventY < 0.8) {
				return {tabPanel: matchingTabPanel, relativeDropPosition: RelativeDropPosition.TAB};
			} else if (relativeEventX < 0.5 && relativeEventY > relativeEventX && (1 - relativeEventY) > relativeEventX) {
				return {tabPanel: matchingTabPanel, relativeDropPosition: RelativeDropPosition.LEFT};
			} else if (relativeEventX > 0.5 && relativeEventY < relativeEventX && (1 - relativeEventY) < relativeEventX) {
				return {tabPanel: matchingTabPanel, relativeDropPosition: RelativeDropPosition.RIGHT};
			} else if (relativeEventY < 0.5 && relativeEventY < relativeEventX && relativeEventY < (1 - relativeEventX)) {
				return {tabPanel: matchingTabPanel, relativeDropPosition: RelativeDropPosition.TOP}
			} else { //if (relativeEventY > 0.5 && relativeEventY > relativeEventX && relativeEventY > (1 - relativeEventX)) {
				return {tabPanel: matchingTabPanel, relativeDropPosition: RelativeDropPosition.BOTTOM}
			}
		} else {
			return null;
		}
	}

	private findParentTabPanel(target: HTMLElement): TabPanelItem {
		let allTabPanelItems = this.itemTree.getAllTabPanelItems();
		let matchingTabPanel: TabPanelItem;
		while (target != null && target != this.$mainDiv[0]) {
			matchingTabPanel = allTabPanelItems.filter(item => item.component.getMainDomElement()[0] === target)[0];
			if (matchingTabPanel) {
				break;
			} else {
				target = target.parentElement;
			}
		}
		return matchingTabPanel;
	}

	private setRootItem(item: ItemTreeItem<UiComponent<UiComponentConfig>>): void {
		if (this.itemTree.rootItem != null && isEmptyable(this.itemTree.rootItem.component)) {
			this.itemTree.rootItem.component.onEmptyStateChanged.removeListener(this.onRootItemEmptyStateChanged);
		}
		this.itemTree.rootItem = item;
		item.component.getMainDomElement().appendTo(this.$contentContainer);
		item.component.attachedToDom = this.attachedToDom;
		if (isEmptyable(item.component)) {
			item.component.onEmptyStateChanged.addListener(this.onRootItemEmptyStateChanged);
			this.onRootItemEmptyStateChanged(item.component.empty);
		}
	}

	@bind
	private onRootItemEmptyStateChanged(empty: boolean) {
		this.$contentContainer.toggleClass("hidden", empty)
	}

	@bind
	private createTabPanelItem(config: UiWorkSpaceLayoutViewGroupItemConfig, parent: SplitPaneItem) {
		let tabPanelItem = new TabPanelItem(config.id, config.persistent, parent, this.context);
		tabPanelItem.onTabSelected.addListener(this.tabSelected);
		tabPanelItem.onTabNeedsRefresh.addListener(this.tabNeedsRefresh);
		tabPanelItem.onPanelStateChangeTriggered.addListener(panelState => this.setViewGroupPanelState2(tabPanelItem, panelState, true));
		tabPanelItem.onTabClosed.addListener(tabId => {
			if (tabPanelItem.tabs.length === 0) {
				this.setViewGroupPanelState2(tabPanelItem, UiViewGroupPanelState.NORMAL, false);
			}
			this.workSpaceLayout.onViewClosed.fire(EventFactory.createUiWorkSpaceLayout_ViewClosedEvent(this.workSpaceLayoutId, tabId));
		});
		return tabPanelItem;
	}

	@bind
	private tabSelected(eventObject: { tabPanelItemId: string, tabId: string }, tabPanelItem: TabPanelItem) {
		let otherViewNames = tabPanelItem.tabs.map(tab => tab.viewName).filter(otherViewName => otherViewName !== eventObject.tabId);
		if (!this.viewEventsSuppressed) {
			this.workSpaceLayout.onViewSelected.fire(EventFactory.createUiWorkSpaceLayout_ViewSelectedEvent(this.workSpaceLayoutId, eventObject.tabPanelItemId, eventObject.tabId, otherViewNames));
		}
	}

	@bind
	private tabNeedsRefresh(eventObject: { tabId: string }) {
		if (!this.viewEventsSuppressed) {
			this.workSpaceLayout.onViewNeedsRefresh.fire(EventFactory.createUiWorkSpaceLayout_ViewNeedsRefreshEvent(this.workSpaceLayoutId, eventObject.tabId));
		}
	}

	private createView(newViewConfig: UiWorkSpaceLayoutViewConfig) {
		return new View(newViewConfig.viewName, newViewConfig.tabIcon, newViewConfig.tabCaption, newViewConfig.tabCloseable, newViewConfig.lazyLoading, newViewConfig.visible, newViewConfig.component);
	}

	addViewToTopLevel(newViewConfig: UiWorkSpaceLayoutViewConfig, windowId: string, relativePosition: UiRelativeWorkSpaceViewPosition, sizePolicy: UiSplitSizePolicy, referenceChildSize: number): void {
		// windowId can be ignored here, since this method is only invoked if this is the target window!
		let view = this.createView(newViewConfig);
		this.addViewItemToNewPosition(view, null, relativePosition, sizePolicy, referenceChildSize);
	}

	addViewRelativeToOtherView(newViewConfig: UiWorkSpaceLayoutViewConfig, existingViewName: string, relativePosition: UiRelativeWorkSpaceViewPosition, sizePolicy: UiSplitSizePolicy, referenceChildSize: number): void {
		let view = this.createView(newViewConfig);
		this.addViewItemToNewPosition(view, existingViewName, relativePosition, sizePolicy, referenceChildSize);
	}

	addViewAsTab(newViewConfig: UiWorkSpaceLayoutViewConfig, itemId: string, select: boolean): void {
		let view = this.createView(newViewConfig);
		this.itemTree.getTabPanelById(itemId).addTab(view, select);
		this.itemTree.updateIndex();
	}

	addViewAsNeighbourTab(newViewConfig: UiWorkSpaceLayoutViewConfig, existingViewName: string, select: boolean): void {
		let view = this.createView(newViewConfig);
		this.itemTree.getViewByName(existingViewName).parent.addTab(view, select);
		this.itemTree.updateIndex();
	}

	private addViewItemToNewPosition(view: View, existingViewName: string, relativePosition: UiRelativeWorkSpaceViewPosition, sizePolicy: UiSplitSizePolicy, referenceChildSize: number) {
		if (existingViewName != null) {
			let siblingView: View = this.itemTree.getViewByName(existingViewName);
			let siblingTabPanelItem = siblingView.parent;
			let oldParent = siblingTabPanelItem.parent;
			let existingTabPanelIsPosition: 'ROOT' | 'FIRST' | 'LAST' = oldParent == null ? 'ROOT' : oldParent.firstChild === siblingTabPanelItem ? 'FIRST' : 'LAST';
			let newItemWillBeFirstChild = [UiRelativeWorkSpaceViewPosition.LEFT, UiRelativeWorkSpaceViewPosition.TOP].indexOf(relativePosition) !== -1;

			let isVerticalSplit = [UiRelativeWorkSpaceViewPosition.LEFT, UiRelativeWorkSpaceViewPosition.RIGHT].indexOf(relativePosition) !== -1;
			let newSplitPaneItem = new SplitPaneItem(generateUUID(), oldParent, isVerticalSplit ? UiSplitDirection.VERTICAL : UiSplitDirection.HORIZONTAL, sizePolicy, referenceChildSize, this.context);
			let newTabPanelItem = this.createTabPanelItem({id: generateUUID(), viewNames: []}, newSplitPaneItem);
			newTabPanelItem.addTab(view, true);

			if (existingTabPanelIsPosition === 'FIRST') {
				oldParent.component.firstChildComponent.getMainDomElement().detach();
				oldParent.firstChild = newSplitPaneItem;
			} else if (existingTabPanelIsPosition === 'LAST') {
				oldParent.component.lastChildComponent.getMainDomElement().detach();
				oldParent.lastChild = newSplitPaneItem;
			} else { // siblingTabPanelItem is root!
				siblingTabPanelItem.component.getMainDomElement().detach();
				this.setRootItem(newSplitPaneItem);
			}

			newSplitPaneItem.firstChild = newItemWillBeFirstChild ? newTabPanelItem : siblingTabPanelItem;
			newSplitPaneItem.lastChild = newItemWillBeFirstChild ? siblingTabPanelItem : newTabPanelItem;

			siblingTabPanelItem.parent = newSplitPaneItem
		} else {
			if (this.itemTree.viewCount === 0) {
				let rootTabPanelItem = this.itemTree.rootItem as TabPanelItem;
				rootTabPanelItem.addTab(view, true);
			} else {
				let isVerticalSplit = [UiRelativeWorkSpaceViewPosition.LEFT, UiRelativeWorkSpaceViewPosition.RIGHT].indexOf(relativePosition) !== -1;
				let splitPaneItem = new SplitPaneItem(generateUUID(), null, isVerticalSplit ? UiSplitDirection.VERTICAL : UiSplitDirection.HORIZONTAL, sizePolicy, referenceChildSize, this.context);
				let oldRootItem = this.itemTree.rootItem;
				oldRootItem.component.getMainDomElement().detach();
				this.setRootItem(splitPaneItem);

				let newTabPanelItem = this.createTabPanelItem({id: generateUUID(), viewNames: []}, splitPaneItem);
				newTabPanelItem.addTab(view, true);
				oldRootItem.parent = splitPaneItem;

				let newItemWillBeFirstChild = [UiRelativeWorkSpaceViewPosition.LEFT, UiRelativeWorkSpaceViewPosition.TOP].indexOf(relativePosition) !== -1;
				splitPaneItem.firstChild = newItemWillBeFirstChild ? newTabPanelItem : oldRootItem;
				splitPaneItem.lastChild = newItemWillBeFirstChild ? oldRootItem : newTabPanelItem;
			}
		}
		if (view.component) {
			view.component.attachedToDom = this._attachedToDom;
		}
		this.itemTree.updateIndex();
	}

	public removeView(viewName: string, updateIndex = true) {
		let view = this.itemTree.getViewByName(viewName);
		if (view == null) {
			LocalViewContainer.logger.warn(`Cannot remove view ${viewName}. View not found.`);
			return;
		}
		let tabPanelItem: TabPanelItem = view.parent;
		tabPanelItem.removeTab(view);
		if (tabPanelItem.tabs.length === 0 && !tabPanelItem.persistent) {
			this.removeEmptyTabPanelFromItemTree(tabPanelItem);
		}
		if (updateIndex) {
			this.itemTree.updateIndex();
		}
		if (this.windowId !== UiWorkSpaceLayout.ROOT_WINDOW_ID && this.itemTree.viewCount === 0) {
			window.close();
		}
	}

	private removeEmptyTabPanelFromItemTree(tabPanelItem: TabPanelItem) {
		let parentSplitPaneItem = tabPanelItem.parent;
		if (parentSplitPaneItem != null) { // else tabPanelItem is the rootItem, so do NOT remove it!
			// remove this tabPanel. The parent splitPane is now also needless...
			let tabPanelItemIsFirstChild = parentSplitPaneItem.firstChild === tabPanelItem;
			let siblingItem: ItemTreeItem<UiComponent<UiComponentConfig>>;
			if (tabPanelItemIsFirstChild) {
				siblingItem = parentSplitPaneItem.lastChild;
				siblingItem.component.getMainDomElement().detach();
				parentSplitPaneItem.lastChild = null;
			} else {
				siblingItem = parentSplitPaneItem.firstChild;
				siblingItem.component.getMainDomElement().detach();
				parentSplitPaneItem.firstChild = null;
			}
			let grandParentSplitPaneItem = parentSplitPaneItem.parent;
			if (grandParentSplitPaneItem != null) {
				let parentSplitPaneItemIsFirstChild = grandParentSplitPaneItem.firstChild === parentSplitPaneItem;
				if (parentSplitPaneItemIsFirstChild) {
					grandParentSplitPaneItem.firstChild = siblingItem;
				} else {
					grandParentSplitPaneItem.lastChild = siblingItem;
				}
			} else {
				parentSplitPaneItem.component.destroy();
				parentSplitPaneItem.component.getMainDomElement().detach();
				this.setRootItem(siblingItem);
				siblingItem.parent = null;
			}
		}
	}

	moveViewToTopLevel(viewName: string, windowId: string, relativePosition: UiRelativeWorkSpaceViewPosition, sizePolicy: UiSplitSizePolicy, referenceChildSize: number): void {
		this.moveViewRelativeToOtherView(viewName, null, relativePosition, sizePolicy, referenceChildSize);
	}

	moveViewRelativeToOtherView(viewName: string, newSiblingName: string, relativePosition: UiRelativeWorkSpaceViewPosition, sizePolicy: UiSplitSizePolicy, referenceChildSize: number): void {
		let view = this.itemTree.getViewByName(viewName);
		if (viewName === newSiblingName && view.parent.tabs.length <= 1) {
			return; // would not have any effect anyway
		}
		view.component.getMainDomElement().detach();
		this.removeView(viewName, false);
		this.addViewItemToNewPosition(view, newSiblingName, relativePosition, sizePolicy, referenceChildSize);
	}

	moveViewToTab(viewName: string, newSiblingName: string): void {
		let view = this.itemTree.getViewByName(viewName);
		if (viewName === newSiblingName) {
			return; // would not have any effect anyway
		}
		view.component.getMainDomElement().detach();
		this.removeView(viewName, false);
		this.itemTree.getViewByName(newSiblingName).parent.addTab(view, true);
		this.itemTree.updateIndex();
	}

	public refreshViewComponent(viewName: string, component: UiComponent) {
		let view = this.itemTree.getViewByName(viewName);
		view.component = component;
		if (view.component) {
			view.component.attachedToDom = this._attachedToDom;
		}
	}

	refreshViewAttributes(viewName: string, tabIcon: string, tabCaption: string, tabCloseable: boolean, visible: boolean): void {
		let view = this.itemTree.getViewByName(viewName);
		view.updateTabAttributes(tabIcon, tabCaption, tabCloseable, visible);
	}

	setViewVisible(viewName: string, visible: boolean): void {
		let view = this.itemTree.getViewByName(viewName);
		view.setVisible(visible);
	}

	redefineLayout(newLayout: UiWorkSpaceLayoutItemConfig, addedViewConfigs: UiWorkSpaceLayoutViewConfig[]): void {
		let newRootItem = new LayoutDescriptorApplyer(
			this.$contentContainer,
			this.createTabPanelItem,
			(viewGroupItem, panelState) => this.setViewGroupPanelState(viewGroupItem.id, panelState),
			this.context
		).apply(this.itemTree.rootItem, newLayout, addedViewConfigs);
		this.setRootItem(newRootItem)
	}

	selectViewTab(viewName: string) {
		let tabPanel = this.itemTree.getTabPanelForView(viewName);
		if (tabPanel) {
			tabPanel.selectTab(viewName);
		}
	}

	@bind
	setViewGroupPanelState(viewGroupId: string, panelState: UiViewGroupPanelState): void {
		let tabPanel = this.itemTree.getTabPanelById(viewGroupId);
		if (tabPanel) {
			this.setViewGroupPanelState2(tabPanel, panelState, false);
		}
	}

	private setViewGroupPanelState2(viewGroup: TabPanelItem, panelState: UiViewGroupPanelState, firePanelStateChangeEvent: boolean) {
		const oldPanelState = viewGroup.state;
		if (oldPanelState != panelState) {
			if (panelState === UiViewGroupPanelState.MAXIMIZED) {
				this.maximizeTabPanel(viewGroup);
			} else if (panelState === UiViewGroupPanelState.MINIMIZED) {
				this.minimizeTabPanel(viewGroup);
			} else {
				this.restoreTabPanel(viewGroup);
			}
			if (firePanelStateChangeEvent) {
				this.workSpaceLayout.fireViewGroupPanelStateChanged(viewGroup.id, panelState);
			}
		}
	}

	private minimizeTabPanel(tabPanelItem: TabPanelItem) {
		if (tabPanelItem.maximized) {
			this.restoreTabPanel(tabPanelItem);
		}
		tabPanelItem.state = UiViewGroupPanelState.MINIMIZED;
		this.$minimizedViewsBar.append(tabPanelItem.$minimizedTrayButton);
		this.reLayout();
	}

	private maximizeTabPanel(tabPanelItem: TabPanelItem) {
		const $element = tabPanelItem.component.getMainDomElement();
		this.$normalContainerOfMaximizedTabPanel = $element.parent();
		this.$maximizationContainerWrapper.addClass("show");
		this.$maximizationContainer.append($element).addClass("animated zoomIn");
		tabPanelItem.component.reLayout();
		tabPanelItem.state = UiViewGroupPanelState.MAXIMIZED;
	}

	private restoreTabPanel(tabPanelItem: TabPanelItem) {
		if (tabPanelItem.state === UiViewGroupPanelState.MAXIMIZED) {
			const $element = tabPanelItem.component.getMainDomElement();
			this.$maximizationContainerWrapper.removeClass("show");
			this.$maximizationContainer.append($element).removeClass("animated zoomIn");
			$element.appendTo(this.$normalContainerOfMaximizedTabPanel);
			tabPanelItem.state = UiViewGroupPanelState.NORMAL;
			tabPanelItem.component.reLayout();
		} else if (tabPanelItem.state === UiViewGroupPanelState.MINIMIZED) {
			tabPanelItem.$minimizedTrayButton.detach();
			tabPanelItem.state = UiViewGroupPanelState.NORMAL;
			tabPanelItem.component.reLayout();
		}
	}

	public set attachedToDom(attachedToDom: boolean) {
		let wasAttachedToDom = this._attachedToDom;
		this._attachedToDom = attachedToDom;
		if (attachedToDom && !wasAttachedToDom) {
			this.onAttachedToDom();
		}
	}

	public get attachedToDom() {
		return this._attachedToDom;
	}

	private onAttachedToDom() {
		if (this._toolbar) this._toolbar.attachedToDom = true;
		if (this.itemTree.rootItem.component) this.itemTree.rootItem.component.attachedToDom = true;
	}

	reLayout() {
		this.$contentContainer.css("overflow", "hidden"); // enforce container size (from flex layout) over children sizes!
		this._toolbar && this._toolbar.reLayout();
		this.itemTree.rootItem && this.itemTree.rootItem.component.reLayout();
		this.$contentContainer.css("overflow", "visible");
	}

	destroy() {
		if (this.itemTree.rootItem.component) this.itemTree.rootItem.component.destroy();
		this.$maximizationContainerWrapper.detach();
	}

	getMainDomElement() {
		return this.$mainDiv;
	}

	private createLayoutDescriptor(item: ItemTreeItem<UiComponent<UiComponentConfig>>): UiWorkSpaceLayoutItemConfig {
		if (item instanceof SplitPaneItem) {
			return createUiWorkSpaceLayoutSplitItemConfig(item.id, item.splitDirection, this.createLayoutDescriptor(item.firstChild), this.createLayoutDescriptor(item.lastChild), {
				sizePolicy: item.sizePolicy,
				referenceChildSize: item.referenceChildSize
			})
		} else if (item instanceof TabPanelItem) {
			return createUiWorkSpaceLayoutViewGroupItemConfig(item.id, item.tabs.map(view => view.viewName), {
				selectedViewName: item.component.getSelectedTabId(),
				panelState: item.state,
				persistent: item.persistent
			});
		}
	}

	async getLayoutDescriptor(): Promise<WindowLayoutDescriptor> {
		return {
			windowId: this.windowId,
			layout: this.createLayoutDescriptor(this.itemTree.rootItem)
		};
	}

	private fireViewNeedsRefreshForAllEmptyVisibleLazyTabs() {
		this.itemTree.getAllTabPanelItems()
			.forEach(tabPanelItem => {
				let selectedTabId: string = tabPanelItem.component.getSelectedTabId();
				if (selectedTabId != null) { // might be completely empty!
					let selectedView: View = tabPanelItem.tabs.filter(tab => tab.viewName === selectedTabId)[0];
					if (selectedView.component == null && selectedView.lazyLoading) {
						this.workSpaceLayout.onViewNeedsRefresh.fire(EventFactory.createUiWorkSpaceLayout_ViewNeedsRefreshEvent(this.workSpaceLayoutId, selectedTabId));
					}
				}
			});
	}
}
