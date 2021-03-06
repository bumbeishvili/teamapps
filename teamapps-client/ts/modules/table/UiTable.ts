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
///<reference types="slickgrid"/>
///<reference types="slickgrid/slick.checkboxselectcolumn"/>
///<reference types="slickgrid/slick.rowselectionmodel"/>


import * as $ from "jquery";
import {TeamAppsEvent} from "../util/TeamAppsEvent";
import {
	UiTable_CellEditingStartedEvent,
	UiTable_CellEditingStoppedEvent,
	UiTable_ColumnSizeChangeEvent,
	UiTable_DisplayedRangeChangedEvent,
	UiTable_FieldOrderChangeEvent,
	UiTable_MultipleRowsSelectedEvent,
	UiTable_RequestNestedDataEvent,
	UiTable_RowSelectedEvent,
	UiTable_SortingChangedEvent,
	UiTableCommandHandler,
	UiTableConfig,
	UiTableEventSource
} from "../../generated/UiTableConfig";
import {UiField, ValueChangeEventData} from "../formfield/UiField";
import {DEFAULT_TEMPLATES, keyCodes} from "trivial-components";
import {UiTableColumnConfig} from "../../generated/UiTableColumnConfig";
import {UiCompositeFieldTableCellEditor} from "./UiCompositeFieldTableCellEditor";
import {debouncedMethod} from "../util/debounce";
import {UiComponent} from "../UiComponent";
import {UiDropDown} from "../micro-components/UiDropDown";
import {TeamAppsUiContext} from "../TeamAppsUiContext";
import {executeWhenAttached} from "../util/ExecuteWhenAttached";
import {arraysEqual, manipulateWithoutTransitions} from "../Common";
import {UiSortDirection} from "../../generated/UiSortDirection";
import {EventFactory} from "../../generated/EventFactory";
import {TeamAppsUiComponentRegistry} from "../TeamAppsUiComponentRegistry";
import {UiGenericTableCellEditor} from "./UiGenericTableCellEditor";
import {FixedSizeTableCellEditor} from "./FixedSizeTableCellEditor";
import {createUiColorCssString} from "../util/CssFormatUtil";
import {UiHierarchicalClientRecordConfig} from "../../generated/UiHierarchicalClientRecordConfig";
import {TableDataProvider, TableDataProviderItem} from "./TableDataProvider";
import {UiButton, UiCheckBox, UiCompositeField, UiCurrencyField, UiFileField, UiMultiLineTextField, UiNumberField, UiRichTextEditor} from "..";
import {UiFieldMessageConfig} from "../../generated/UiFieldMessageConfig";
import {FieldMessagesPopper, getHighestSeverity} from "../micro-components/FieldMessagesPopper";
import {nonRecursive} from "../util/nonRecursive";
import {createUiTableDataRequestConfig} from "../../generated/UiTableDataRequestConfig";
import {throttledMethod} from "../util/throttle";
import {UiFieldMessageSeverity} from "../../generated/UiFieldMessageSeverity";
import {UiTableClientRecordConfig} from "../../generated/UiTableClientRecordConfig";
import EventData = Slick.EventData;
import OnHeaderRowCellRenderedEventArgs = Slick.OnHeaderRowCellRenderedEventArgs;
import {UiTableRowSelectionModel} from "./UiTableRowSelectionModel";

interface Column extends Slick.Column<any> {
	id: string;
	field: string;
	uiField?: UiField;
	name: string;
	width: number;
	minWidth?: number;
	maxWidth?: number;
	formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<TableDataProviderItem>, dataContext: TableDataProviderItem) => string;
	asyncEditorLoading?: boolean;
	autoEdit?: boolean;
	focusable: boolean;
	sortable: boolean;
	resizable: boolean;
	headerCssClass?: string;
	cssClass?: string,
	cannotTriggerInsert?: boolean,
	unselectable?: boolean,
	hiddenIfOnlyEmptyCellsVisible: boolean,
	messages?: UiFieldMessageConfig[],
	uiConfig?: UiTableColumnConfig
}

const backgroundColorCssClassesByMessageSeverity = {
	[UiFieldMessageSeverity.INFO]: "bg-info",
	[UiFieldMessageSeverity.SUCCESS]: "bg-success",
	[UiFieldMessageSeverity.WARNING]: "bg-warning",
	[UiFieldMessageSeverity.ERROR]: "bg-danger",
};

export class UiTable extends UiComponent<UiTableConfig> implements UiTableCommandHandler, UiTableEventSource {

	public readonly onCellEditingStarted: TeamAppsEvent<UiTable_CellEditingStartedEvent> = new TeamAppsEvent(this);
	public readonly onCellEditingStopped: TeamAppsEvent<UiTable_CellEditingStoppedEvent> = new TeamAppsEvent(this);
	public readonly onRowSelected: TeamAppsEvent<UiTable_RowSelectedEvent> = new TeamAppsEvent(this);
	public readonly onMultipleRowsSelected: TeamAppsEvent<UiTable_MultipleRowsSelectedEvent> = new TeamAppsEvent<UiTable_MultipleRowsSelectedEvent>(this);
	public readonly onSortingChanged: TeamAppsEvent<UiTable_SortingChangedEvent> = new TeamAppsEvent(this);
	public readonly onRequestNestedData: TeamAppsEvent<UiTable_RequestNestedDataEvent> = new TeamAppsEvent(this);
	public readonly onFieldOrderChange: TeamAppsEvent<UiTable_FieldOrderChangeEvent> = new TeamAppsEvent(this);
	public readonly onColumnSizeChange: TeamAppsEvent<UiTable_ColumnSizeChangeEvent> = new TeamAppsEvent(this);
	public readonly onDisplayedRangeChanged: TeamAppsEvent<UiTable_DisplayedRangeChangedEvent> = new TeamAppsEvent(this);

	private $component: JQuery;
	private _grid: Slick.Grid<any>;
	private allColumns: Column[];
	private dataProvider: TableDataProvider;
	private _$loadingIndicator: JQuery;
	private loadingIndicatorFadeInTimer: number;

	private _sortField: string;
	private _sortDirection: UiSortDirection;

	private lastSelectedRowIds: number[];

	private doNotFireEventBecauseSelectionIsCausedByApiCall: boolean = false; // slickgrid fires events even if we set the selection via api...

	private dropDown: UiDropDown;
	private $selectionFrame: JQuery;
	private headerRowFields: { [fieldName: string]: UiField } = {};
	private footerRowFields: { [fieldName: string]: UiField } = {};

	private $editorFieldTempContainer: JQuery;

	constructor(config: UiTableConfig, context: TeamAppsUiContext) {
		super(config, context);
		this.$component = $(`<div class="UiTable" id="${config.id}">
    <div class="slick-table"></div>
    <div class="editor-field-temp-container hidden"></div>
</div>`);
		const $table = this.$component.find(".slick-table");
		if (config.stripedRows) {
			$table.addClass("striped-rows");
		}
		this.$editorFieldTempContainer = this.$component.find(".editor-field-temp-container");

		this.dataProvider = new TableDataProvider(config.tableData, (fromIndex: number, length: number) => {
			const viewPort = this._grid.getViewport();
			const currentlyDisplayedRecordIds = this.getCurrentlyDisplayedRecordIds();
			this.onDisplayedRangeChanged.fire(EventFactory.createUiTable_DisplayedRangeChangedEvent(
				config.id, viewPort.top, viewPort.bottom - viewPort.top, currentlyDisplayedRecordIds,
				createUiTableDataRequestConfig(fromIndex, length, this._sortField, this._sortDirection)
			));
		});
		if (config.totalNumberOfRecords > this.dataProvider.getLength()) {
			this.dataProvider.setTotalNumberOfRootNodes(config.totalNumberOfRecords);
		}

		this.createSlickGrid(config, $table);

		this.dropDown = new UiDropDown();
	}

	private isRowExpanded(item: UiHierarchicalClientRecordConfig): boolean {
		return item.expanded;
	}

	@executeWhenAttached()
	private createSlickGrid(config: UiTableConfig, $table: JQuery) {
		this.allColumns = this._createColumns();

		if (config.showRowCheckBoxes) {
			var checkboxSelector = new Slick.CheckboxSelectColumn({
				cssClass: "justify-center"
			});
			this.allColumns.unshift(checkboxSelector.getColumnDefinition() as Column);
		}
		if (config.showNumbering) {
			const RowNumberFormatter: Slick.Formatter<TableDataProviderItem> = (row: number, cell: number, value: any, columnDef: Slick.Column<TableDataProviderItem>, dataContext: TableDataProviderItem) => {
				return "" + (row + 1);
			};
			this.allColumns.unshift({
				id: "__rowNumber",
				name: "#",
				field: "",
				formatter: RowNumberFormatter,
				cssClass: "justify-right",
				headerCssClass: "text-right",
				width: 35,
				maxWidth: 75,
				cannotTriggerInsert: true,
				resizable: true,
				unselectable: true,
				sortable: false,
				focusable: false,
				hiddenIfOnlyEmptyCellsVisible: false
			});
		}

		const options: Slick.GridOptions<any> & { createFooterRow: boolean, showFooterRow: boolean, footerRowHeight: number } = {
			explicitInitialization: true,
			enableCellNavigation: true,
			enableColumnReorder: false,
			forceFitColumns: config.forceFitWidth,
			fullWidthRows: true,
			rowHeight: config.rowHeight + config.rowBorderWidth,
			multiColumnSort: false,
			multiSelect: config.allowMultiRowSelection,
			enableTextSelectionOnCells: false, // see also CSS style user-select: none
			editable: config.editable,
			editCommandHandler: (item: TableDataProviderItem, column: Column, editCommand: any) => {
				column.uiField.commit();
				editCommand.execute();
			},
			showHeaderRow: config.showHeaderRow,
			headerRowHeight: config.headerRowHeight,
			createFooterRow: true,
			showFooterRow: config.showFooterRow,
			footerRowHeight: config.footerRowHeight,
		};

		this._grid = new Slick.Grid($table, this.dataProvider, this.getVisibleColumns(), options);

		if (config.headerRowFields) {
			this.configureOuterFields(config.headerRowFields, true);
			this.headerRowFields = config.headerRowFields;
		}
		if (config.footerRowFields) {
			this.configureOuterFields(config.footerRowFields, false);
			this.footerRowFields = config.footerRowFields;
		}

		if (config.hideHeaders) {
			$table.find(".slick-header-columns").css({
				height: 0,
				border: "none"
			});
			//this._grid.resizeCanvas();
		}

		$table.addClass(config.displayAsList ? 'list-mode' : 'table-mode');

		this._grid.setSelectionModel(new UiTableRowSelectionModel());

		if (config.showRowCheckBoxes) {
			this._grid.registerPlugin(checkboxSelector);
		}

		this._grid.onViewportChanged.subscribe(() => this.ensureDataForCurrentViewPort());
		this._$loadingIndicator = $(DEFAULT_TEMPLATES.defaultSpinnerTemplate).hide().appendTo($table);
		this.dataProvider.onDataLoading.subscribe(() => {
			clearTimeout(this.loadingIndicatorFadeInTimer);
			this.loadingIndicatorFadeInTimer = window.setTimeout(() => {
				this._$loadingIndicator.fadeIn();
			}, 2000);
		});
		if (config.sortField) {
			this._sortField = config.sortField;
			this._sortDirection = config.sortDirection;
			this._grid.setSortColumn(config.sortField, config.sortDirection === UiSortDirection.ASC);
		}
		this._grid.onSort.subscribe((e, args: Slick.OnSortEventArgs<Slick.SlickData>) => {
			this._sortField = args.sortCol.id;
			this._sortDirection = args.sortAsc ? UiSortDirection.ASC : UiSortDirection.DESC;
			this.onSortingChanged.fire(EventFactory.createUiTable_SortingChangedEvent(config.id, this._sortField, args.sortAsc ? UiSortDirection.ASC : UiSortDirection.DESC));
		});
		this._grid.onSelectedRowsChanged.subscribe((eventData, args) => {
			if (args.rows.some((row) => !this.dataProvider.getItem(row))) {
				return; // one of the selected rows has no id (so it does not seem to be loaded yet). ==> do not fire an event.
			}
			if (!this.doNotFireEventBecauseSelectionIsCausedByApiCall
				&& JSON.stringify(this.lastSelectedRowIds) !== JSON.stringify(args.rows)) {
				this.lastSelectedRowIds = args.rows;
				if (args.rows.length === 1) {
					this.onRowSelected.fire(EventFactory.createUiTable_RowSelectedEvent(
						config.id,
						this.dataProvider.getItem(args.rows[0]).id,
						false, // see click handlers on canvas element...
						false // see click handlers on canvas element...
					));
				} else if (args.rows.length > 1) {
					this.onMultipleRowsSelected.fire(EventFactory.createUiTable_MultipleRowsSelectedEvent(
						config.id,
						args.rows.map((selectionIndex) => {
							return this.dataProvider.getItem(selectionIndex).id;
						})
					));
				}
			}
			this.updateSelectionFramePosition(true);
		});
		this._grid.onCellChange.subscribe((eventData: EventData, data) => {
			this.updateSelectionFramePosition(true);
		});
		this._grid.onClick.subscribe((e: MouseEvent, args: Slick.OnClickEventArgs<TableDataProviderItem>) => {
			setTimeout(/* make sure the table updated its activeCell property! */ () => {
				const column = this._grid.getColumns()[args.cell];
				let fieldName = column.id;
				let uiField: UiField = (column as Column).uiField;
				let item = this.dataProvider.getItem(args.row);
				if (item) { // may be undefined if this is a new row!
					let isIndentedColumn = fieldName === this._config.indentedColumnName;
					if (isIndentedColumn && $(e.target).hasClass("teamapps-table-row-expander")) {
						$(e.target).toggleClass("expanded");
						if ((item as any).lazyChildren && !item.children && !this.isRowExpanded(item)) {
							this.requestLazyChildren(item.id);
						}
						this.dataProvider.toggleRowExpanded(args.row);
						this.rerenderAllRows();
					}
					let cellValue: any = item.values[fieldName];
					let $buttonElement = $(e.target).closest(".UiButton");
					if (uiField && uiField instanceof UiButton && $buttonElement.length > 0) {
						this.logger.warn("TODO: handle button click, especially in case of a dropdown...");
						// uiField.onValueChanged.fire(null);
						// this.dropDown.setContentComponent(null);
						// this.dropDown.open($buttonElement, {
						// 	width: uiButton.minDropDownWidth,
						// 	minHeight: uiButtonConfig.minDropDownHeight
						// });
					} else if (uiField instanceof UiFileField) {
						let $templateWrapper = $((<any>e).target).closest(".custom-entry-template-wrapper");
						if ($templateWrapper.length > 0) {
							let index = $templateWrapper.parent().index($templateWrapper);
							this.logger.warn("TODO: handle file field click");
						}
					}
				}
			});
		});
		this._grid.onBeforeEditCell.subscribe((e, data: Slick.OnBeforeEditCellEventArgs<any>) => {
			let id = data.item && data.item.id;
			let fieldName = this._grid.getColumns()[data.cell].field;
			if (id != null && fieldName != null) {
				this.onCellEditingStarted.fire(EventFactory.createUiTable_CellEditingStartedEvent(this.getId(), id, fieldName, data.item.values[fieldName]));
			}
		});
		this._grid.onBeforeCellEditorDestroy.subscribe((e, data: Slick.OnBeforeCellEditorDestroyEventArgs<any>) => {
			const dataItem = this._grid.getDataItem(this._grid.getActiveCell().row);
			if (dataItem != null) { // might be null if table data was replaced during editing...
				let id = dataItem.id;
				let fieldName = this._grid.getColumns()[this._grid.getActiveCell().cell].field;
				if (id != null && fieldName != null) {
					this.onCellEditingStopped.fire(EventFactory.createUiTable_CellEditingStoppedEvent(this.getId(), id, fieldName));
				}
			}
		});
		$(this._grid.getCanvasNode()).dblclick((e) => {
			let cell = this._grid.getCellFromEvent(<any>e);
			if (cell != null) {
				this.onRowSelected.fire(EventFactory.createUiTable_RowSelectedEvent(
					config.id,
					this.dataProvider.getItem(cell.row).id,
					false,
					true
				));
			}
		});

		$(this._grid.getCanvasNode()).on("contextmenu", (e) => {
			let cell = this._grid.getCellFromEvent(<any>e);
			this.onRowSelected.fire(EventFactory.createUiTable_RowSelectedEvent(
				config.id,
				this.dataProvider.getItem(cell.row).id,
				true,
				false
			));
		});

		if (config.selectionFrame) {
			this.$selectionFrame = $(`<div class="UiTable-selection-frame">`)
				.css({
					"border": `${this._config.selectionFrame.borderWidth}px solid ${createUiColorCssString(this._config.selectionFrame.color)}`,
					"box-shadow": `0 0 ${this._config.selectionFrame.shadowWidth}px 0 rgba(0, 0, 0, .5), 0 0 ${this._config.selectionFrame.glowingWidth}px 0 ${createUiColorCssString(this._config.selectionFrame.color)}`,
					"transition": `top ${this._config.selectionFrame.animationDuration}ms, left ${this._config.selectionFrame.animationDuration}ms, right ${this._config.selectionFrame.animationDuration}ms, width ${this._config.selectionFrame.animationDuration}ms, height ${this._config.selectionFrame.animationDuration}ms`
				})
				.appendTo(this.$component);
		}
		this._grid.onScroll.subscribe((eventData) => {
			this.updateSelectionFramePosition();
			this.fireDisplayedRangeChanged(config);
		});
		this._grid.onViewportChanged.subscribe((eventData) => {
			this.toggleColumnsThatAreHiddenWhenTheyContainNoVisibleNonEmptyCells();
		});
		this._grid.onColumnsResized.subscribe((eventData) => {
			this.rerenderAllRows();
			this.updateSelectionFramePosition();
		});
		this._grid.onHeaderMouseEnter.subscribe((e, args) => {
			const fieldName = args.column.id;

			const columnMessages = this.getColumnById(fieldName).messages;
			const cellHasMessages = columnMessages.length > 0;
			if (cellHasMessages) {
				this.fieldMessagePopper.setReferenceElement((e as any).currentTarget);
				this.fieldMessagePopper.setMessages([...columnMessages]);
				this.fieldMessagePopper.setVisible(true);
			} else {
				this.fieldMessagePopper.setVisible(false);
			}
		});
		this._grid.onMouseEnter.subscribe((e, args) => {
			const cell = this._grid.getCellFromEvent(e as any);
			const item = this.dataProvider.getItem(cell.row);
			if (item == null) {
				return;
			}
			const fieldName = (this._grid.getColumns()[cell.cell] as Column).id;

			const cellMessages = (item.messages && item.messages[fieldName] || []);
			const columnMessages = this.getColumnById(fieldName).messages;
			const cellHasMessages = cellMessages.length > 0 || columnMessages.length > 0;
			const isEditorCell = this._grid.getCellEditor() != null && this._grid.getActiveCell().row === cell.row && this._grid.getActiveCell().cell === cell.cell;
			if (!isEditorCell && cellHasMessages) {
				this.fieldMessagePopper.setReferenceElement(this._grid.getCellNode(cell.row, cell.cell));
				this.fieldMessagePopper.setMessages([...cellMessages, ...columnMessages]);
				this.fieldMessagePopper.setVisible(true);
			} else {
				this.fieldMessagePopper.setVisible(false);
			}
		});
		this._grid.onMouseLeave.subscribe((e, args) => {
			this.fieldMessagePopper.setVisible(false);
		});
		this._grid.init();
	}

	private ensureDataForCurrentViewPort() {
		const vp = this._grid.getViewport();
		this.dataProvider.ensureData(vp.top, vp.bottom);
	}

	@throttledMethod(500) // debounce/throttle scrolling without data requests only!!! (otherwise the tableDataProvider will mark rows as requested but the actual request will not get to the server)
	private fireDisplayedRangeChanged(config: UiTableConfig) {
		const viewport = this._grid.getViewport();
		this.onDisplayedRangeChanged.fire(EventFactory.createUiTable_DisplayedRangeChangedEvent(config.id, viewport.top, viewport.bottom - viewport.top, this.getCurrentlyDisplayedRecordIds(), null));
	}

	@nonRecursive
	private toggleColumnsThatAreHiddenWhenTheyContainNoVisibleNonEmptyCells() {
		let range = this._grid.getViewport();
		let columns: Column[] = this.getVisibleColumns();
		let usedColumns: { [key: string]: true } = {};
		columns.filter(c => !c.hiddenIfOnlyEmptyCellsVisible).forEach(c => usedColumns[c.id] = true);
		const lastRowIndex = Math.min(range.bottom + 1 /*bottom seems to be inclusive*/, this.dataProvider.getLength());
		for (let i = range.top; i < lastRowIndex; i++) {
			let item = this.dataProvider.getItem(i);
			if (item == null) {
				return; // an item is not loaded yet. This makes updating the columns unnecessary (until the item is loaded)!
			}
			columns.forEach(c => {
				if (item.values[c.id] != null) {
					usedColumns[c.id] = true;
				}
			})
		}
		let columnsToDisplay = columns.filter(c => usedColumns[c.id] == true);
		if (!arraysEqual(columnsToDisplay.map(c => c.id), this._grid.getColumns().map(c => c.id))) {
			this.setSlickGridColumns(columnsToDisplay);
		}
	}

	private configureOuterFields(fieldsByColumnId: { [columnName: string]: UiField }, header: boolean) {
		let renderedEvent: Slick.Event<OnHeaderRowCellRenderedEventArgs<any>> = header ? this._grid.onHeaderRowCellRendered : (this._grid as any).onFooterRowCellRendered;
		renderedEvent.subscribe((e, args) => {
			$(args.node)[0].innerHTML = '';
			const columnName = args.column.id;
			let field = fieldsByColumnId[columnName];
			if (field) {
				field.getMainDomElement().appendTo(args.node);
			}
		});
	}

	private getCurrentlyDisplayedRecordIds() {
		const viewPort = this._grid.getViewport();
		const currentlyDisplayedRecordIds = [];
		for (let i = viewPort.top; i <= viewPort.bottom; i++) {
			const item = this.dataProvider.getItem(i);
			if (item != null) {
				currentlyDisplayedRecordIds.push(item.id);
			}
		}
		return currentlyDisplayedRecordIds;
	}

	public getMainDomElement(): JQuery {
		return this.$component;
	}

	protected onAttachedToDom() {
		//this._grid.updateCanvasWidth(true);
		if (this._grid != null) {
			this._grid.scrollRowToTop(0); // the scroll position gets lost when the table gets detached, so it is necessary to inform it that it should display the top of the table
		}
		this.reLayout();
	}

	private _createColumns(): Column[] {
		const columns: Column[] = [];
		for (let i = 0; i < this._config.columns.length; i++) {
			const slickColumnConfig = this.createSlickColumnConfig(this._config.columns[i]);
			columns.push(slickColumnConfig);
		}
		return columns;
	}

	private createSlickColumnConfig(columnConfig: UiTableColumnConfig): Column {
		const uiField: UiField = columnConfig.field;
		this.prepareEditorField(columnConfig.propertyName, uiField);

		let editorFactory;
		if (uiField instanceof UiCompositeField) {
			editorFactory = UiCompositeFieldTableCellEditor.bind(null, uiField, () => uiField.getMainDomElement().appendTo(this.$editorFieldTempContainer));
		} else if (uiField instanceof UiRichTextEditor || uiField instanceof UiMultiLineTextField) {
			editorFactory = FixedSizeTableCellEditor.bind(null, uiField, () => uiField.getMainDomElement().appendTo(this.$editorFieldTempContainer));
		} else {
			editorFactory = UiGenericTableCellEditor.bind(null, uiField, () => uiField.getMainDomElement().appendTo(this.$editorFieldTempContainer));
		}

		const slickColumnConfig: Column = {
			id: columnConfig.propertyName,
			field: columnConfig.propertyName,
			uiField: uiField,
			name: `<div class="column-header-icon img img-16 ${columnConfig.icon == null ? "hidden" : ""}" style="background-image: url(${this._context.getIconPath(columnConfig.icon, 16)})"></div>
<div class="column-header-title">${columnConfig.title}</div>`,
			width: columnConfig.defaultWidth || ((columnConfig.minWidth + columnConfig.maxWidth) / 2) || undefined,
			minWidth: columnConfig.minWidth || 30,
			maxWidth: columnConfig.maxWidth || undefined,
			formatter: this.createCellFormatter(uiField),
			editor: editorFactory,
			asyncEditorLoading: false,
			autoEdit: true,
			focusable: this._config.displayAsList || uiField.isEditable(),
			sortable: columnConfig.sortable,
			resizable: columnConfig.resizeable,
			hiddenIfOnlyEmptyCellsVisible: columnConfig.hiddenIfOnlyEmptyCellsVisible,
			messages: columnConfig.messages,
			uiConfig: columnConfig
		};

		slickColumnConfig.headerCssClass = this.getColumnCssClass(slickColumnConfig);
		slickColumnConfig.cssClass = this.getColumnCssClass(slickColumnConfig);

		return slickColumnConfig;
	}


	private getColumnCssClass(column: Column) {
		let columnCssClasses: string[] = [];
		if (column.uiField instanceof UiNumberField || column.uiField instanceof UiCurrencyField) {
			columnCssClasses.push('justify-right');
		} else if (column.uiField instanceof UiCheckBox || column.uiField instanceof UiButton) {
			columnCssClasses.push('justify-center');
		}
		const highestSeverity = getHighestSeverity(column.messages, null);
		if (highestSeverity != null) {
			columnCssClasses.push(backgroundColorCssClassesByMessageSeverity[highestSeverity]);
		}
		return columnCssClasses.join(" ");
	}

	private prepareEditorField(columnPropertyName: string, uiField: UiField) {
		uiField.getMainDomElement().appendTo(this.$editorFieldTempContainer);
		if (uiField.getFocusableElement()) {
			uiField.getFocusableElement().on("keydown.nav", (e) => {
				if (e.keyCode === keyCodes.left_arrow
					|| e.keyCode === keyCodes.right_arrow
					|| e.keyCode === keyCodes.up_arrow
					|| e.keyCode === keyCodes.down_arrow) {
					e.stopPropagation();
				}
			});
			uiField.getFocusableElement()
				.focus(() => uiField.getMainDomElement().css("z-index", 1000))
				.blur(() => uiField.getMainDomElement().css("z-index", 0));
		}
		uiField.onValueChanged.addListener((eventData: ValueChangeEventData) => this.handleFieldValueChanged(columnPropertyName, eventData.value));
		uiField.onVisibilityChanged.addListener(visible => this.setSlickGridColumns(this.getVisibleColumns()));

		if (uiField instanceof UiCompositeField) {
			uiField.onSubFieldValueChanged.addListener((eventData) => {
				this.handleFieldValueChanged(eventData.fieldName, eventData.value);
				this._grid.getDataItem(this._grid.getActiveCell().row)[eventData.fieldName] = eventData.value;
			});
		}
	}

	private createCellFormatter(field: UiField) {
		const createInnerCellFormatter = () => {
			if (field instanceof UiCompositeField) {
				this.logger.warn("TODO: create cell formatter for UiCompositeField!");
				return null;
				// return (row: number, cell: number, value: any, columnDef: Slick.Column<TableDataProviderItem>, dataContext: TableDataProviderItem) => {
				// return field.getReadOnlyHtml(field as UiCompositeFieldConfig, {_type: "UiRecordValue", value: dataContext}, this._context, columnDef.width + 1);
				// };
			} else if (field.getReadOnlyHtml) {
				return (row: number, cell: number, value: any, columnDef: Slick.Column<TableDataProviderItem>, dataContext: TableDataProviderItem) => {
					return field.getReadOnlyHtml(dataContext.values[columnDef.id], columnDef.width);
				};
			} else {
				return null;
			}
		};

		const innerCellFormatter = createInnerCellFormatter(); // may be undefined!
		return (row: number, cell: number, value: any, columnDef: Slick.Column<TableDataProviderItem>, dataContext: TableDataProviderItem) => {
			const innerHtml = innerCellFormatter ? innerCellFormatter(row, cell, value, columnDef, dataContext) : "###";
			const highestMessageSeverity = getHighestSeverity(dataContext.messages && dataContext.messages[columnDef.id], null);
			const fieldCssClasses: string[] = [];
			if (dataContext.bold) {
				fieldCssClasses.push("text-bold");
			}
			if (highestMessageSeverity != null) {
				fieldCssClasses.push(this.getCellMessageCssClassName(highestMessageSeverity));
			}
			let additionalHtml = "";
			if (dataContext.markings != null && dataContext.markings.some(propertyName => propertyName === columnDef.id)) {
				additionalHtml += `<div class="cell-marker"></div>`;
			}
			const cellClass = fieldCssClasses.join(" ");
			let isIndentedColumn = this._config.indentedColumnName === columnDef.id;
			let hasChildren = dataContext.children || (dataContext as any).lazyChildren;
			return `<div class="validation-class-wrapper ${cellClass}" style="${isIndentedColumn && dataContext.depth > 0 ? 'padding-left: ' + (dataContext.depth * this._config.indentation) + 'px' : ''}">
    ${isIndentedColumn ? `<div class="teamapps-expander teamapps-table-row-expander ${this.isRowExpanded(dataContext) ? 'expanded' : ''} ${hasChildren ? '' : 'invisible'}" data-depth="${dataContext.depth}"></div>` : ''}
    <div class="anti-overflow-wrapper">
    	${innerHtml}
	</div>
	${additionalHtml}
</div>`;
		};
	}

	private getCellMessageCssClassName(severity: UiFieldMessageSeverity) {
		return "message-" + UiFieldMessageSeverity[severity].toLowerCase();
	}

	@executeWhenAttached()
	public clearTable() {
		this.dataProvider.clear();
		this._grid.setData(this.dataProvider, true);
		this._grid.render();
		this._grid.setSelectedRows([]);
	}

	@executeWhenAttached()
	public addData(startIndex: number,
	               data: UiTableClientRecordConfig[],
	               totalNumberOfRecords: number,
	               sortField: string,
	               sortDirection: UiSortDirection,
	               clearTableCache: boolean) {
		if (clearTableCache) {
			this.dataProvider.clear();
			this._grid.setSelectedRows([]);
		}

		this._sortField = sortField;
		this._sortDirection = sortDirection;
		if (sortField) {
			this._grid.setSortColumn(sortField, sortDirection === UiSortDirection.ASC);
		}

		const tableData = data;
		this.dataProvider.updateRootNodeData(startIndex, tableData);
		for (let i = 0; i < tableData.length; i++) {
			this._grid.invalidateRow(startIndex + i);
		}

		if (totalNumberOfRecords != this.dataProvider.getLength()) {
			this.dataProvider.setTotalNumberOfRootNodes(totalNumberOfRecords);
		}

		this._grid.updateRowCount();
		this._grid.render();
		this.toggleColumnsThatAreHiddenWhenTheyContainNoVisibleNonEmptyCells();

		const selectedRows = this._grid.getSelectedRows();
		selectedRows.push(...data.filter(record => record.selected).map(record => this.dataProvider.findVisibleRowIndexById(record.id)));
		this._grid.setSelectedRows(selectedRows);

		clearTimeout(this.loadingIndicatorFadeInTimer);
		this._$loadingIndicator.fadeOut();

		this._grid.resizeCanvas();
		this.updateSelectionFramePosition();

		if (clearTableCache) {
			this.ensureDataForCurrentViewPort();
		}
	}

	@executeWhenAttached()
	removeData(ids: number[]): void {
		let deletedItemRowNumbers = Object.values(this.dataProvider.findVisibleRowIndexesByIds(ids));
		deletedItemRowNumbers.sort();

		function numberOfSmallerDeletedRows(rowNumber: number) {
			let i = 0;
			while (i < deletedItemRowNumbers.length && ids[i] < rowNumber) {
				i++;
			}
			return i;
		}

		this.dataProvider.removeItems(ids);

		let newSelectedRows = this._grid.getSelectedRows()
			.filter(selectedRowIndex => deletedItemRowNumbers.indexOf(selectedRowIndex) == -1)
			.map(selectedRowIndex => selectedRowIndex - numberOfSmallerDeletedRows(selectedRowIndex));
		this._grid.setSelectedRows(newSelectedRows);

		this.rerenderAllRows();
	}

	insertRows(index: number, data: UiTableClientRecordConfig[]): void {
		this.dataProvider.insertRows(index, data);
		this.rerenderAllRows();
	}

	deleteRows(ids: number[]): void {
		this.dataProvider.deleteItems(ids);
		this.rerenderAllRows();
	}

	@executeWhenAttached()
	public setChildrenData(recordId: any, data: any[]) {
		let tableData = data;
		this.dataProvider.setChildrenData(recordId, tableData);

		// TODO #events
		this.rerenderAllRows();
	}

	@executeWhenAttached()
	public setCellValue(recordId: any, fieldName: string, data: any) {
		const node = this.dataProvider.getNodeById(recordId);
		if (node) {
			node.values[fieldName] = data;
		}
		this.rerenderRecordRow(recordId);
	}

	@executeWhenAttached()
	public updateRecord(record: UiTableClientRecordConfig) {
		this.dataProvider.updateNode(record);
		this.rerenderRecordRow(record.id);
	}

	private rerenderRecordRow(recordId: any) {
		const rowIndex = this.dataProvider.findVisibleRowIndexById(recordId); // TODO #events
		if (rowIndex != null) {
			let editing = this._grid.getCellEditor();

			this._grid.invalidateRow(rowIndex);
			this._grid.render();

			if (editing && this.getActiveCellRecordId() && this.getActiveCellRecordId() === recordId) {
				this._grid.editActiveCell(null);
			}
		}
	}

	// private cellMessages: {[recordId: number]: {[fieldName: string]: UiFieldMessageConfig[]}} = {};
	private fieldMessagePopper = new FieldMessagesPopper();

	setSingleCellMessages(recordId: number, fieldName: string, messages: UiFieldMessageConfig[]): void {
		if (messages == null) {
			messages = [];
		}
		this.dataProvider.setCellMessages(recordId, fieldName, messages);
		this.rerenderRecordRow(recordId);
	}

	clearAllCellMessages() {
		this.dataProvider.clearAllCellMessages();
		this.rerenderAllRows();
	}

	private rerenderAllRows() {
		if (this._grid != null) {
			this._grid.invalidateAllRows();
			this._grid.updateRowCount();
			this._grid.render();
			this.toggleColumnsThatAreHiddenWhenTheyContainNoVisibleNonEmptyCells();
		}
	}

	setColumnMessages(fieldName: string, messages: UiFieldMessageConfig[]): void {
		const column = this.getColumnById(fieldName);
		column.messages = messages;
		const columnCssClass = this.getColumnCssClass(column);
		column.headerCssClass = column.cssClass = columnCssClass;
		this.setSlickGridColumns(this.getVisibleColumns());
	}

	private getVisibleColumns() {
		return this.allColumns.filter(column => !column.uiField || column.uiField.isVisible());
	}

	private getColumnById(id: string) {
		return this.allColumns.filter(column => column.id === id)[0];
	}

	@executeWhenAttached()
	public markTableField(recordId: any, fieldName: string, mark: boolean) {
		this.dataProvider.setCellMarked(recordId, fieldName, mark);
		this.rerenderRecordRow(recordId);
	}

	@executeWhenAttached()
	public clearAllFieldMarkings() {
		this.dataProvider.clearAllFieldMarkings();
		for (let i = 0; i < this.dataProvider.getLength(); i++) {
			this._grid.invalidateRow(i);
		}
		this._grid.render();
	}

	@executeWhenAttached()
	public setRecordBold(recordId: any, bold: boolean) {
		let rowIndex = this.dataProvider.findVisibleRowIndexById(recordId);
		if (rowIndex == null) {
			return;
		}
		const record = this.dataProvider.getItem(rowIndex);
		record.bold = bold;
		this._grid.invalidateRow(rowIndex);
		this._grid.render();
	}

	@executeWhenAttached()
	public selectRows(recordIds: number[], scrollToFirstRecord: boolean /*TODO*/) {
		const rowIndexes = Object.values(this.dataProvider.findVisibleRowIndexesByIds(recordIds));

		this.doNotFireEventBecauseSelectionIsCausedByApiCall = true;
		try {
			if (rowIndexes.length > 0) {
				this._grid.setSelectedRows(rowIndexes);
				this._grid.scrollRowToTop(rowIndexes[0]);
			} else {
				this._grid.setSelectedRows([]);
			}
		} finally {
			this.doNotFireEventBecauseSelectionIsCausedByApiCall = false;
		}
	}

	editCellIfAvailable(recordId: number, propertyName: string): void {
		const rowNumber = this.dataProvider.findVisibleRowIndexById(recordId);
		if (rowNumber != null) {
			this._grid.setActiveCell(rowNumber, this._grid.getColumns().findIndex(c => c.id === propertyName));
			this._grid.editActiveCell(null);
		}
	}

	@executeWhenAttached()
	public focusCell(recordId: any, columnPropertyName: string) {
		const rowIndex = this.dataProvider.findVisibleRowIndexById(recordId);
		if (rowIndex != null) {
			let columnIndex = this._grid.getColumnIndex(columnPropertyName);
			if (columnIndex != null) {
				this._grid.setActiveCell(rowIndex, columnIndex);
				this._grid.editActiveCell(null);
			} else {
				let compositeFieldColumnIndex = this.getCompositeFieldColumnForSubFieldName(columnPropertyName);
				if (compositeFieldColumnIndex != null) {
					this._grid.setActiveCell(rowIndex, compositeFieldColumnIndex);
					this._grid.editActiveCell(null);
					((<any>this._grid.getCellEditor()).uiField as UiCompositeField).focusField(columnPropertyName);
				}
			}
		}
	}

	@executeWhenAttached(true)
	@debouncedMethod(300)
	public onResize(): void {
		this._grid.resizeCanvas();
		this.rerenderAllRows();
		this._grid.getCellEditor() && (this._grid.getCellEditor() as any).onResize();
		this.updateSelectionFramePosition();
	}

	private handleFieldValueChanged(fieldName: string, value: any): void {
		// console.log("changed: " + fieldName + ": " + value);
		// TODO check if this has updated a boolean field and update composite fields accordingly (field visibilities)
	}

	private getCompositeFieldColumnForSubFieldName(columnPropertyName: string): number {
		if (this.allColumns.filter(c => c.id == columnPropertyName).length !== 0) {
			return null; // this is a normal field...
		}
		for (let col = 0; col < this.allColumns.length; col++) {
			let field = this.allColumns[col].uiField;
			if (field && field instanceof UiCompositeField) {
				if (field.getSubFields().filter(subField => subField.config.propertyName === columnPropertyName).length > 0) {
					return col;
				}
			}
		}
		return null;
	}

	private requestLazyChildren(recordId: any) {
		this.onRequestNestedData.fire(EventFactory.createUiTable_RequestNestedDataEvent(this.getId(), recordId));
	}

	private getActiveCellValue() {
		if (this._grid.getActiveCell()) {
			return this._grid.getDataItem(this._grid.getActiveCell().row)[this._grid.getColumns()[this._grid.getActiveCell().cell].field];
		}
	};

	private getActiveCellRecordId(): any {
		if (this._grid.getActiveCell()) {
			let dataItem: TableDataProviderItem = this._grid.getDataItem(this._grid.getActiveCell().row);
			return dataItem ? dataItem.id : null;
		}
	}

	private getActiveCellFieldName() {
		if (this._grid.getActiveCell()) {
			return this._grid.getColumns()[this._grid.getActiveCell().cell].id;
		}
	}

	public destroy(): void {
		this.fieldMessagePopper.destroy();
	}

	private updateSelectionFramePosition(animate: boolean = false) {
		let selectionFrame = this._config.selectionFrame;
		if (selectionFrame == null) {
			return;
		}
		let activeCellNode = this._grid.getActiveCellNode();
		if (activeCellNode == null) {
			manipulateWithoutTransitions(this.$selectionFrame, () => {
				let $cell: JQuery = $(activeCellNode);
				this.$selectionFrame
					.css({
						top: -10000,
						left: -10000
					});
			}, false);
		} else {
			manipulateWithoutTransitions(this.$selectionFrame, () => {
				let $cell: JQuery = $(activeCellNode);
				this.$selectionFrame
					.css({
						top: ($cell.offset().top - this.$component.offset().top) - selectionFrame.borderWidth,
						left: selectionFrame.fullRow ? -selectionFrame.borderWidth : parseInt($cell.css('left')) - selectionFrame.borderWidth - this._grid.getViewport().leftPx,
						width: selectionFrame.fullRow ? $cell.parent().width() + 2 * selectionFrame.borderWidth + 1 : $cell.parent().width() - parseInt($cell.css('left')) - parseInt($cell.css('right')) + 2 * selectionFrame.borderWidth - 1,
						height: $cell.outerHeight() + 2 * selectionFrame.borderWidth - this._config.rowBorderWidth
					});
			}, animate);
		}
	}

	@executeWhenAttached()
	addColumns(columnConfigs: UiTableColumnConfig[], index: number): void {
		const slickColumnConfigs = this._grid.getColumns();
		const newSlickColumnConfigs = columnConfigs.map(columnConfig => this.createSlickColumnConfig(columnConfig));
		slickColumnConfigs.splice(index, 0, ...newSlickColumnConfigs);
		this.allColumns = slickColumnConfigs as Column[];
		this.dataProvider.clear();
		this.setSlickGridColumns(this.getVisibleColumns());
	}

	private setSlickGridColumns(columns: Column[]) {
		Object.values(this.headerRowFields).forEach(f => f.getMainDomElement().detach()); // prevent slickgrid from doing this via jQuery's empty() (and thereby removing all events handlers)
		Object.values(this.footerRowFields).forEach(f => f.getMainDomElement().detach()); // prevent slickgrid from doing this via jQuery's empty() (and thereby removing all events handlers)
		this._grid.setColumns(columns);
	}

	@executeWhenAttached()
	removeColumns(columnNames: string[]): void {
		const slickColumnConfigs = this._grid.getColumns()
			.filter(c => columnNames.indexOf(c.id) === -1);
		this.allColumns = slickColumnConfigs as Column[];
		this.dataProvider.clear();
		this.setSlickGridColumns(this.getVisibleColumns());
	}

	cancelEditingCell(recordId: number, propertyName: string): void {
		if (recordId === this.getActiveCellRecordId() && propertyName === this.getActiveCellFieldName()) {
			this._grid.getEditController().cancelCurrentEdit();
		}
	}

}

TeamAppsUiComponentRegistry.registerComponentClass("UiTable", UiTable);
