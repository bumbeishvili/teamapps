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
package org.teamapps.ux.application;

import org.teamapps.ux.application.perspective.Perspective;
import org.teamapps.ux.application.view.View;
import org.teamapps.ux.application.view.ViewSize;
import org.teamapps.ux.component.toolbar.Toolbar;
import org.teamapps.ux.component.toolbar.ToolbarButtonGroup;
import org.teamapps.ux.component.workspacelayout.definition.LayoutItemDefinition;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class ResponsiveApplicationToolbar implements ApplicationChangeHandler {

    private Toolbar toolbar = new Toolbar();

    public ResponsiveApplicationToolbar() {
    }

    public Toolbar getToolbar() {
        return toolbar;
    }

    @Override
    public void handleApplicationViewAdded(ResponsiveApplication application, View view) {
        //todo check if already in toolbar
        view.getWorkspaceButtonGroups().forEach(group -> toolbar.addButtonGroup(group));
    }

    @Override
    public void handleApplicationViewRemoved(ResponsiveApplication application, View view) {
        view.getWorkspaceButtonGroups().forEach(group -> toolbar.removeToolbarButtonGroup(group));
    }

    @Override
    public void handlePerspectiveChange(ResponsiveApplication application, Perspective perspective, Perspective previousPerspective, List<View> activeViews, List<View> addedViews, List<View> removedViews) {
        Set<ToolbarButtonGroup> addGroups = new HashSet<>();
        Set<ToolbarButtonGroup> removeGroups = new HashSet<>();

        addedViews.forEach(view -> addGroups.addAll(view.getWorkspaceButtonGroups()));
        addGroups.addAll(perspective.getWorkspaceButtonGroups());

        if (previousPerspective != null) {
            removedViews.forEach(view -> removeGroups.addAll(view.getWorkspaceButtonGroups()));
            removeGroups.addAll(previousPerspective.getWorkspaceButtonGroups());
            removeGroups.removeAll(addGroups);
        }

        removeGroups.forEach(group -> toolbar.removeToolbarButtonGroup(group));
        addGroups.forEach(group -> toolbar.addButtonGroup(group));
    }

    @Override
    public void handleApplicationToolbarButtonGroupAdded(ResponsiveApplication application, ToolbarButtonGroup buttonGroup) {
        toolbar.addButtonGroup(buttonGroup);
    }

    @Override
    public void handleApplicationToolbarButtonGroupRemoved(ResponsiveApplication application, ToolbarButtonGroup buttonGroup) {
        toolbar.removeToolbarButtonGroup(buttonGroup);
    }

    @Override
    public void handleLayoutChange(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, LayoutItemDefinition layout) {
        //todo check removed views through layout change...
    }

    @Override
    public void handleViewAdded(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view) {
        if (isActivePerspective) {
            //todo check if already in toolbar
            view.getWorkspaceButtonGroups().forEach(group -> toolbar.addButtonGroup(group));
        }
    }

    @Override
    public void handleViewRemoved(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view) {
        if (isActivePerspective) {
            view.getWorkspaceButtonGroups().forEach(group -> toolbar.removeToolbarButtonGroup(group));
        }
    }

    @Override
    public void handlePerspectiveToolbarButtonGroupAdded(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, ToolbarButtonGroup buttonGroup) {
        if (isActivePerspective) {
            toolbar.addButtonGroup(buttonGroup);
        }
    }

    @Override
    public void handlePerspectiveToolbarButtonGroupRemoved(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, ToolbarButtonGroup buttonGroup) {
        if (isActivePerspective) {
            toolbar.removeToolbarButtonGroup(buttonGroup);
        }
    }

    @Override
    public void handleViewVisibilityChange(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, boolean visible) {
        if (isActivePerspective) {
            if (visible) {
                view.getWorkspaceButtonGroups().forEach(group -> toolbar.addButtonGroup(group));
            } else {
                view.getWorkspaceButtonGroups().forEach(group -> toolbar.removeToolbarButtonGroup(group));
            }
        }
    }

    @Override
    public void handleViewFocusRequest(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, boolean ensureVisible) {

    }

    @Override
    public void handleViewSizeChange(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, ViewSize viewSize) {

    }

    @Override
    public void handleViewTabTitleChange(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, String title) {

    }

    @Override
    public void handleViewLayoutPositionChange(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, String position) {

    }

    @Override
    public void handleViewWorkspaceToolbarButtonGroupAdded(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, ToolbarButtonGroup buttonGroup) {
        if (isActivePerspective) {
            toolbar.addButtonGroup(buttonGroup);
        }
    }

    @Override
    public void handleViewWorkspaceToolbarButtonGroupRemoved(ResponsiveApplication application, boolean isActivePerspective, Perspective perspective, View view, ToolbarButtonGroup buttonGroup) {
        if (isActivePerspective) {
            toolbar.removeToolbarButtonGroup(buttonGroup);
        }
    }

}
