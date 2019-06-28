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
package org.teamapps.ux.component.calendar;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.teamapps.common.format.Color;
import org.teamapps.data.extract.BeanPropertyExtractor;
import org.teamapps.data.extract.PropertyExtractor;
import org.teamapps.dto.UiCalendar;
import org.teamapps.dto.UiCalendarEventClientRecord;
import org.teamapps.dto.UiCalendarEventRenderingStyle;
import org.teamapps.dto.UiComponent;
import org.teamapps.dto.UiEvent;
import org.teamapps.dto.UiWeekDay;
import org.teamapps.event.Event;
import org.teamapps.event.EventListener;
import org.teamapps.icon.material.MaterialIcon;
import org.teamapps.ux.cache.CacheManipulationHandle;
import org.teamapps.ux.cache.ClientRecordCache;
import org.teamapps.ux.component.AbstractComponent;
import org.teamapps.ux.component.field.combobox.TemplateDecider;
import org.teamapps.ux.component.template.BaseTemplate;
import org.teamapps.ux.component.template.BaseTemplateRecord;
import org.teamapps.ux.component.template.Template;
import org.teamapps.ux.component.toolbar.ToolbarButton;
import org.teamapps.ux.component.toolbar.ToolbarButtonGroup;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.teamapps.util.UiUtil.createUiColor;

public class Calendar<RECORD> extends AbstractComponent {

	private final Logger LOGGER = LoggerFactory.getLogger(Calendar.class);

	public final Event<EventClickedEventData<RECORD>> onEventClicked = new Event<>();
	public final Event<EventMovedEventData<RECORD>> onEventMoved = new Event<>();
	public final Event<DayClickedEventData> onDayClicked = new Event<>();
	public final Event<ViewChangedEventData> onViewChanged = new Event<>();
	public final Event<LocalDate> onMonthHeaderClicked = new Event<>();
	public final Event<WeeHeaderClickedEventData> onWeekHeaderClicked = new Event<>();
	public final Event<LocalDate> onDayHeaderClicked = new Event<>();

	private CalendarModel<RECORD> model;
	private PropertyExtractor<RECORD> propertyExtractor = new BeanPropertyExtractor<>();

	ClientRecordCache<CalendarEvent<RECORD>, UiCalendarEventClientRecord> recordCache = new ClientRecordCache<>(this::createUiCalendarEventClientRecord);

	private Template dayViewTemplate = null; // null: use default rendering...
	private TemplateDecider<CalendarEvent<RECORD>> dayViewTemplateDecider = record -> dayViewTemplate;
	private Template monthViewTemplate = null; // null: use default rendering...
	private TemplateDecider<CalendarEvent<RECORD>> monthViewTemplateDecider = record -> monthViewTemplate;
	private int templateIdCounter = 0;
	private final Map<Template, String> templateIdsByTemplate = new HashMap<>();

	private CalendarViewMode activeViewMode = CalendarViewMode.MONTH;
	private LocalDate displayedDate = LocalDate.now();
	private boolean showHeader = false;
	private boolean tableBorder = false;
	private boolean showWeekNumbers = true;
	private int businessHoursStart = 8;
	private int businessHoursEnd = 17;
	private DayOfWeek firstDayOfWeek = DayOfWeek.MONDAY; // TODO get from session settings!
	private List<DayOfWeek> workingDays = java.util.Arrays.asList(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);
	private Color tableHeaderBackgroundColor;

	private Color defaultBackgroundColor = new Color(154, 204, 228);
	private Color defaultBorderColor = new Color(154, 204, 228);

	private int minYearViewMonthTileWidth = 175;
	private int maxYearViewMonthTileWidth = 0;

	private ZoneId timeZone = getSessionContext().getTimeZone();

	protected boolean navigateOnHeaderClicks = true;

	private EventListener<Void> onCalendarDataChangedListener = (aVoid) -> {
		refreshEvents();
	};

	public Calendar() {
		this(null);
	}

	public Calendar(CalendarModel<RECORD> model) {
		if (model != null) {
			setModel(model);
		}
	}

	private UiCalendarEventClientRecord createUiCalendarEventClientRecord(CalendarEvent<RECORD> calendarEvent) {
		Template template = getTemplateForRecord(calendarEvent);
		Map<String, Object> values = template != null ? propertyExtractor.getValues(calendarEvent.getRecord(), template.getDataKeys()) : Collections.emptyMap();
		UiCalendarEventClientRecord uiRecord = new UiCalendarEventClientRecord();
		uiRecord.setValues(values);

		uiRecord.setTemplateId(templateIdsByTemplate.get(template));

		uiRecord.setStart(calendarEvent.getStartAsLong());
		uiRecord.setEnd(calendarEvent.getEndAsLong());
		uiRecord.setAsString(template == null && calendarEvent.getRecord() != null ? calendarEvent.getRecord().toString() : null);
		uiRecord.setAllDay(calendarEvent.isAllDay());
		uiRecord.setAllowDragOperations(calendarEvent.isAllowDragOperations());
		uiRecord.setBackgroundColor(calendarEvent.getBackgroundColor() != null ? createUiColor(calendarEvent.getBackgroundColor()) : null);
		uiRecord.setBorderColor(calendarEvent.getBorderColor() != null ? createUiColor(calendarEvent.getBorderColor()) : null);
		uiRecord.setRendering(calendarEvent.getRendering() != null ? calendarEvent.getRendering().toUiCalendarEventRenderingStyle() : UiCalendarEventRenderingStyle.DEFAULT);

		return uiRecord;
	}

	private Template getTemplateForRecord(CalendarEvent<RECORD> record) {
		if (this.activeViewMode == CalendarViewMode.YEAR) {
			return null; // no template for year view!
		}

		TemplateDecider<CalendarEvent<RECORD>> templateDecider = activeViewMode == CalendarViewMode.MONTH ? monthViewTemplateDecider : dayViewTemplateDecider;
		Template templateFromDecider = templateDecider.getTemplate(record);

		Template defaultTemplate = activeViewMode == CalendarViewMode.MONTH ? monthViewTemplate : dayViewTemplate;

		Template template = templateFromDecider != null ? templateFromDecider : defaultTemplate;
		if (template != null && !templateIdsByTemplate.containsKey(template)) {
			String id = "" + templateIdCounter++;
			this.templateIdsByTemplate.put(template, id);
			queueCommandIfRendered(() -> new UiCalendar.RegisterTemplateCommand(getId(), id, template.createUiTemplate()));
		}
		return template;
	}

	public void setModel(CalendarModel<RECORD> model) {
		if (this.model != null) {
			unregisterModelEventListeners();
		}
		this.model = model;
		model.getOnCalendarDataChanged().addListener(onCalendarDataChangedListener);
		refreshEvents();
	}

	private void unregisterModelEventListeners() {
		this.model.getOnCalendarDataChanged().removeListener(onCalendarDataChangedListener);
	}

	@Override
	public UiComponent createUiComponent() {
		UiCalendar uiCalendar = new UiCalendar();
		mapAbstractUiComponentProperties(uiCalendar);
		uiCalendar.setActiveViewMode(activeViewMode.toUiCalendarViewMode());
		uiCalendar.setDisplayedDate(displayedDate.atStartOfDay(timeZone).toInstant().toEpochMilli());
		uiCalendar.setShowHeader(showHeader);
		uiCalendar.setTableBorder(tableBorder);
		uiCalendar.setShowWeekNumbers(showWeekNumbers);
		uiCalendar.setBusinessHoursStart(businessHoursStart);
		uiCalendar.setBusinessHoursEnd(businessHoursEnd);
		uiCalendar.setFirstDayOfWeek(firstDayOfWeek != null ? UiWeekDay.valueOf(firstDayOfWeek.name()) : null);
		uiCalendar.setWorkingDays(workingDays.stream().map(workingDay -> UiWeekDay.valueOf(workingDay.name())).collect(Collectors.toList()));
		uiCalendar.setTableHeaderBackgroundColor(tableHeaderBackgroundColor != null ? createUiColor(tableHeaderBackgroundColor) : null);
		uiCalendar.setNavigateOnHeaderClicks(navigateOnHeaderClicks);
		uiCalendar.setTimeZoneId(timeZone.getId());
		uiCalendar.setMinYearViewMonthTileWidth(minYearViewMonthTileWidth);
		uiCalendar.setMaxYearViewMonthTileWidth(maxYearViewMonthTileWidth);

		Instant queryStart = activeViewMode.getDisplayStart(displayedDate, firstDayOfWeek).atStartOfDay(timeZone).toInstant();
		Instant queryEnd = activeViewMode.getDisplayEnd(displayedDate, firstDayOfWeek).atStartOfDay(timeZone).toInstant();
		List<CalendarEvent<RECORD>> initialCalendarEvents = query(queryStart, queryEnd);
		CacheManipulationHandle<List<UiCalendarEventClientRecord>> cacheResponse = recordCache.replaceRecords(initialCalendarEvents);
		cacheResponse.commit();
		uiCalendar.setInitialData(cacheResponse.getResult());

		uiCalendar.setTemplates(templateIdsByTemplate.entrySet().stream()
				.collect(Collectors.toMap(Map.Entry::getValue, entry -> entry.getKey().createUiTemplate())));

		return uiCalendar;
	}

	@Override
	protected void doDestroy() {
		if (model != null) {
			unregisterModelEventListeners();
		}
	}

	private List<CalendarEvent<RECORD>> query(Instant queryStart, Instant queryEnd) {
		List<CalendarEvent<RECORD>> events;
		if (model != null) {
			events = model.getEventsForInterval(queryStart, queryEnd);
			LOGGER.debug("Query: " + queryStart + " - " + queryEnd + " --> events:" + events.size());
		} else {
			events = Collections.emptyList();
		}
		return events;
	}

	@Override
	public void handleUiEvent(UiEvent event) {
		switch (event.getUiEventType()) {
			case UI_CALENDAR_EVENT_CLICKED: {
				UiCalendar.EventClickedEvent clickEvent = (UiCalendar.EventClickedEvent) event;
				CalendarEvent<RECORD> calendarEvent = recordCache.getRecordByClientId(clickEvent.getEventId());
				if (calendarEvent != null) {
					onEventClicked.fire(new EventClickedEventData<>(calendarEvent, clickEvent.getIsDoubleClick()));
				}
				break;
			}
			case UI_CALENDAR_EVENT_MOVED: {
				UiCalendar.EventMovedEvent eventMovedEvent = (UiCalendar.EventMovedEvent) event;
				CalendarEvent<RECORD> calendarEvent = recordCache.getRecordByClientId(eventMovedEvent.getEventId());
				if (calendarEvent != null) {
					onEventMoved.fire(new EventMovedEventData<>(calendarEvent, Instant.ofEpochMilli(eventMovedEvent.getNewStart()), Instant.ofEpochMilli(eventMovedEvent.getNewEnd())));
				}

				break;
			}
			case UI_CALENDAR_DAY_CLICKED: {
				UiCalendar.DayClickedEvent dayClickedEvent = (UiCalendar.DayClickedEvent) event;
				onDayClicked.fire(new DayClickedEventData(timeZone, Instant.ofEpochMilli(dayClickedEvent.getDate()), dayClickedEvent.getIsDoubleClick()));
				break;
			}
			case UI_CALENDAR_VIEW_CHANGED: {
				UiCalendar.ViewChangedEvent viewChangedEvent = (UiCalendar.ViewChangedEvent) event;
				this.displayedDate = Instant.ofEpochMilli(viewChangedEvent.getMainIntervalStart()).atZone(timeZone).toLocalDate();
				this.activeViewMode = CalendarViewMode.valueOf(viewChangedEvent.getViewMode().name());
				onViewChanged.fire(new ViewChangedEventData(
						timeZone,
						activeViewMode,
						Instant.ofEpochMilli(viewChangedEvent.getMainIntervalStart()),
						Instant.ofEpochMilli(viewChangedEvent.getMainIntervalEnd()),
						Instant.ofEpochMilli(viewChangedEvent.getDisplayedIntervalStart()),
						Instant.ofEpochMilli(viewChangedEvent.getDisplayedIntervalEnd())
				));
				break;
			}
			case UI_CALENDAR_DATA_NEEDED: {
				UiCalendar.DataNeededEvent dataNeededEvent = (UiCalendar.DataNeededEvent) event;
				Instant queryStart = Instant.ofEpochMilli(dataNeededEvent.getRequestIntervalStart());
				Instant queryEnd = Instant.ofEpochMilli(dataNeededEvent.getRequestIntervalEnd());
				queryAndSendCalendarData(queryStart, queryEnd);
				break;
			}
			case UI_CALENDAR_MONTH_HEADER_CLICKED: {
				UiCalendar.MonthHeaderClickedEvent clickEvent = (UiCalendar.MonthHeaderClickedEvent) event;
				LocalDate startOfMonth = Instant.ofEpochMilli(clickEvent.getMonthStartDate()).atZone(timeZone).toLocalDate();
				onMonthHeaderClicked.fire(startOfMonth);
				break;
			}
			case UI_CALENDAR_WEEK_HEADER_CLICKED: {
				UiCalendar.WeekHeaderClickedEvent clickEvent = (UiCalendar.WeekHeaderClickedEvent) event;
				LocalDate startOfWeek = Instant.ofEpochMilli(clickEvent.getWeekStartDate()).atZone(timeZone).toLocalDate();
				onWeekHeaderClicked.fire(new WeeHeaderClickedEventData(timeZone, clickEvent.getYear(), clickEvent.getWeek(), startOfWeek));
				break;
			}
			case UI_CALENDAR_DAY_HEADER_CLICKED: {
				UiCalendar.DayHeaderClickedEvent clickEvent = (UiCalendar.DayHeaderClickedEvent) event;
				LocalDate date = Instant.ofEpochMilli(clickEvent.getDate()).atZone(timeZone).toLocalDate();
				onDayHeaderClicked.fire(date);
				break;
			}
		}
	}

	private void queryAndSendCalendarData(Instant queryStart, Instant queryEnd) {
		List<CalendarEvent<RECORD>> calendarEvents = query(queryStart, queryEnd);
		CacheManipulationHandle<List<UiCalendarEventClientRecord>> cacheResponse = recordCache.replaceRecords(calendarEvents);
		if (isRendered()) {
			getSessionContext().queueCommand(new UiCalendar.SetCalendarDataCommand(getId(), cacheResponse.getResult()), aVoid -> cacheResponse.commit());
		} else {
			cacheResponse.commit();
		}
	}

	public ToolbarButtonGroup createViewModesToolbarButtonGroup() {
		ToolbarButtonGroup group = new ToolbarButtonGroup();

		ToolbarButton yearViewButton = new ToolbarButton(
				BaseTemplate.TOOLBAR_BUTTON,
				new BaseTemplateRecord(MaterialIcon.EVENT_NOTE, "Year", "12 Months Overview" /*TODO*/)
		);
		yearViewButton.onClick.addListener(toolbarButtonClickEvent -> this.setActiveViewMode(CalendarViewMode.YEAR));
		group.addButton(yearViewButton);

		ToolbarButton monthViewButton = new ToolbarButton(
				BaseTemplate.TOOLBAR_BUTTON,
				new BaseTemplateRecord(MaterialIcon.DATE_RANGE, "Month", "Full Month View")
		);
		monthViewButton.onClick.addListener(toolbarButtonClickEvent -> this.setActiveViewMode(CalendarViewMode.MONTH));
		group.addButton(monthViewButton);

		ToolbarButton weekViewButton = new ToolbarButton(
				BaseTemplate.TOOLBAR_BUTTON,
				new BaseTemplateRecord(MaterialIcon.VIEW_WEEK, "Week", "Week View")
		);
		weekViewButton.onClick.addListener(toolbarButtonClickEvent -> this.setActiveViewMode(CalendarViewMode.WEEK));
		group.addButton(weekViewButton);

		ToolbarButton dayViewButton = new ToolbarButton(
				BaseTemplate.TOOLBAR_BUTTON,
				new BaseTemplateRecord(MaterialIcon.VIEW_DAY, "Day", "Single Day View")
		);
		dayViewButton.onClick.addListener(toolbarButtonClickEvent -> this.setActiveViewMode(CalendarViewMode.DAY));
		group.addButton(dayViewButton);

		return group;
	}

	public ToolbarButtonGroup createNavigationButtonGroup() {
		ToolbarButtonGroup group = new ToolbarButtonGroup();

		ToolbarButton forwardButton = new ToolbarButton(
				BaseTemplate.TOOLBAR_BUTTON,
				new BaseTemplateRecord(MaterialIcon.NAVIGATE_BEFORE, "Previous", null)
		);
		forwardButton.onClick.addListener(toolbarButtonClickEvent -> this.setDisplayedDate(activeViewMode.decrement(displayedDate)));
		group.addButton(forwardButton);

		ToolbarButton backButton = new ToolbarButton(
				BaseTemplate.TOOLBAR_BUTTON,
				new BaseTemplateRecord(MaterialIcon.NAVIGATE_NEXT, "Next", null)
		);
		backButton.onClick.addListener(toolbarButtonClickEvent -> this.setDisplayedDate(activeViewMode.increment(displayedDate)));
		group.addButton(backButton);

		return group;
	}

	public void refreshEvents() {
		Instant queryStart = activeViewMode.getDisplayStart(displayedDate, firstDayOfWeek).atStartOfDay(timeZone).toInstant();
		Instant queryEnd = activeViewMode.getDisplayEnd(displayedDate, firstDayOfWeek).atStartOfDay(timeZone).toInstant();
		queryAndSendCalendarData(queryStart, queryEnd);
	}

	public CalendarModel getModel() {
		return model;
	}

	public CalendarViewMode getActiveViewMode() {
		return activeViewMode;
	}

	public void setActiveViewMode(CalendarViewMode activeViewMode) {
		this.activeViewMode = activeViewMode;
		queueCommandIfRendered(() -> new UiCalendar.SetViewModeCommand(getId(), activeViewMode.toUiCalendarViewMode()));
		refreshEvents();
	}

	public LocalDate getDisplayedDate() {
		return displayedDate;
	}

	public void setDisplayedDate(LocalDate displayedDate) {
		this.displayedDate = displayedDate;
		queueCommandIfRendered(() -> new UiCalendar.SetDisplayedDateCommand(getId(), displayedDate.atStartOfDay(timeZone).toInstant().toEpochMilli()));
	}

	public boolean isShowHeader() {
		return showHeader;
	}

	public void setShowHeader(boolean showHeader) {
		this.showHeader = showHeader;
		reRenderIfRendered();
	}

	public boolean isTableBorder() {
		return tableBorder;
	}

	public void setTableBorder(boolean tableBorder) {
		this.tableBorder = tableBorder;
		reRenderIfRendered();
	}

	public boolean isShowWeekNumbers() {
		return showWeekNumbers;
	}

	public void setShowWeekNumbers(boolean showWeekNumbers) {
		this.showWeekNumbers = showWeekNumbers;
		reRenderIfRendered();
	}

	public int getBusinessHoursStart() {
		return businessHoursStart;
	}

	public void setBusinessHoursStart(int businessHoursStart) {
		this.businessHoursStart = businessHoursStart;
		reRenderIfRendered();
	}

	public int getBusinessHoursEnd() {
		return businessHoursEnd;
	}

	public void setBusinessHoursEnd(int businessHoursEnd) {
		this.businessHoursEnd = businessHoursEnd;
		reRenderIfRendered();
	}

	public DayOfWeek getFirstDayOfWeek() {
		return firstDayOfWeek;
	}

	public void setFirstDayOfWeek(DayOfWeek firstDayOfWeek) {
		this.firstDayOfWeek = firstDayOfWeek;
		reRenderIfRendered();
	}

	public List<DayOfWeek> getWorkingDays() {
		return workingDays;
	}

	public void setWorkingDays(List<DayOfWeek> workingDays) {
		this.workingDays = workingDays;
		reRenderIfRendered();
	}

	public Color getTableHeaderBackgroundColor() {
		return tableHeaderBackgroundColor;
	}

	public void setTableHeaderBackgroundColor(Color tableHeaderBackgroundColor) {
		this.tableHeaderBackgroundColor = tableHeaderBackgroundColor;
		reRenderIfRendered();
	}

	public Color getDefaultBackgroundColor() {
		return defaultBackgroundColor;
	}

	public void setDefaultBackgroundColor(Color defaultBackgroundColor) {
		this.defaultBackgroundColor = defaultBackgroundColor;
	}

	public Color getDefaultBorderColor() {
		return defaultBorderColor;
	}

	public void setDefaultBorderColor(Color defaultBorderColor) {
		this.defaultBorderColor = defaultBorderColor;
	}

	public PropertyExtractor<RECORD> getPropertyExtractor() {
		return propertyExtractor;
	}

	public void setPropertyExtractor(PropertyExtractor<RECORD> propertyExtractor) {
		this.propertyExtractor = propertyExtractor;
	}

	public Template getDayViewTemplate() {
		return dayViewTemplate;
	}

	public void setDayViewTemplate(Template dayViewTemplate) {
		this.dayViewTemplate = dayViewTemplate;
	}

	public TemplateDecider<CalendarEvent<RECORD>> getDayViewTemplateDecider() {
		return dayViewTemplateDecider;
	}

	public void setDayViewTemplateDecider(TemplateDecider<CalendarEvent<RECORD>> dayViewTemplateDecider) {
		this.dayViewTemplateDecider = dayViewTemplateDecider;
	}

	public Template getMonthViewTemplate() {
		return monthViewTemplate;
	}

	public void setMonthViewTemplate(Template monthViewTemplate) {
		this.monthViewTemplate = monthViewTemplate;
	}

	public TemplateDecider<CalendarEvent<RECORD>> getMonthViewTemplateDecider() {
		return monthViewTemplateDecider;
	}

	public void setMonthViewTemplateDecider(TemplateDecider<CalendarEvent<RECORD>> monthViewTemplateDecider) {
		this.monthViewTemplateDecider = monthViewTemplateDecider;
	}

	public ZoneId getTimeZone() {
		return timeZone;
	}

	public void setTimeZone(ZoneId timeZone) {
		this.timeZone = timeZone;
		queueCommandIfRendered(() -> new UiCalendar.SetTimeZoneIdCommand(getId(), timeZone.getId()));
	}

	public int getMinYearViewMonthTileWidth() {
		return minYearViewMonthTileWidth;
	}

	public void setMinYearViewMonthTileWidth(int minYearViewMonthTileWidth) {
		this.minYearViewMonthTileWidth = minYearViewMonthTileWidth;
		reRenderIfRendered();
	}

	public int getMaxYearViewMonthTileWidth() {
		return maxYearViewMonthTileWidth;
	}

	public void setMaxYearViewMonthTileWidth(int maxYearViewMonthTileWidth) {
		this.maxYearViewMonthTileWidth = maxYearViewMonthTileWidth;
		reRenderIfRendered();
	}
}
