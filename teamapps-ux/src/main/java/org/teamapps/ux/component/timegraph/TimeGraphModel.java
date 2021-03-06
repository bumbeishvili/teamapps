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
package org.teamapps.ux.component.timegraph;

import org.teamapps.event.Event;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface TimeGraphModel {

	Event<Void> onDataChanged();

	List<TimeGraphZoomLevel> getZoomLevels();

	Map<String, List<LineChartDataPoint>> getDataPoints(Collection<String> lineIds, TimeGraphZoomLevel zoomLevel, Interval neededIntervalX);

	Interval getDomainX(Collection<String> lineIds);
	
}
