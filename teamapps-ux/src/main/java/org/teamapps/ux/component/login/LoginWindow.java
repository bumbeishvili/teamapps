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
package org.teamapps.ux.component.login;

import org.teamapps.event.Event;
import org.teamapps.icon.material.MaterialIcon;
import org.teamapps.ux.component.field.Button;
import org.teamapps.ux.component.field.DisplayField;
import org.teamapps.ux.component.field.PasswordField;
import org.teamapps.ux.component.field.SpecialKey;
import org.teamapps.ux.component.field.TextField;
import org.teamapps.ux.component.form.ResponsiveForm;
import org.teamapps.ux.component.form.ResponsiveFormConfigurationTemplate;
import org.teamapps.ux.component.form.ResponsiveFormLayout;
import org.teamapps.common.format.Color;
import org.teamapps.ux.component.format.HorizontalElementAlignment;
import org.teamapps.ux.component.format.SizingPolicy;
import org.teamapps.ux.component.format.Spacing;
import org.teamapps.ux.component.panel.ElegantPanel;
import org.teamapps.ux.component.template.BaseTemplate;
import org.teamapps.ux.component.template.BaseTemplateRecord;
import org.teamapps.ux.component.window.Window;
import org.teamapps.ux.session.CurrentSessionContext;
import org.teamapps.ux.session.SessionContext;

public class LoginWindow {
	public Event<LoginData> onLogin = new Event<>();

	private SessionContext sessionContext = CurrentSessionContext.get();

	private TextField loginField;
	private PasswordField passwordField;

	private Button<BaseTemplateRecord> loginButton;
	private Button<BaseTemplateRecord> registerButton;
	private Button<BaseTemplateRecord> forgotPasswordButton;
	private DisplayField errorField;
	private DisplayField headerField;

	private Window window;
	private ElegantPanel elegantPanel;

	public LoginWindow() {
		loginButton = new Button<>(BaseTemplate.FORM_BUTTON, new BaseTemplateRecord(MaterialIcon.CHECK, "Ok"));
		//loginButton.setColor(Color.LIGHT_GRAY);
		headerField = new DisplayField(false, true);
		errorField = new DisplayField(false, true);
		loginField = new TextField();
		passwordField = new PasswordField();

		headerField.setValue("<span style='font-size:150%'>Login</span>");
		errorField.setValue("<span style='font-size:120%;color:#961900'>&nbsp;</span>");
		
		ResponsiveForm<?> loginForm = new ResponsiveForm<>();
		ResponsiveFormConfigurationTemplate template = ResponsiveFormConfigurationTemplate.createDefault();

		loginForm.setConfigurationTemplate(template);
		ResponsiveFormLayout layout = loginForm.addResponsiveFormLayout(360);
		layout.addSection().setDrawHeaderLine(false).setPadding(new Spacing(30, 25)).setCollapsible(false);
		layout.addLabelField(headerField).setColSpan(2);
		layout.addLabelField(errorField).setColSpan(2);
		ResponsiveFormLayout.LabelAndField labelAndField = layout.addLabelAndField(MaterialIcon.PERSON, sessionContext.getLocalized("ux.loginWindow.login"), loginField, true);
		labelAndField.label.getColumnDefinition().setWidthPolicy(SizingPolicy.AUTO);
		labelAndField.field.getColumnDefinition().setWidthPolicy(SizingPolicy.FRACTION);
		layout.addLabelAndField(MaterialIcon.VPN_KEY, sessionContext.getLocalized("ux.loginWindow.password"), passwordField, true);
		layout.addLabelField(loginButton, 1).setHorizontalAlignment(HorizontalElementAlignment.LEFT).setMinWidth(100).getRowDefinition().setTopPadding(10);

		loginButton.onValueChanged.addListener(value -> login());
		loginField.onSpecialKeyPressed.addListener(specialKey -> {
			if (specialKey == SpecialKey.ENTER) {
				login();
			}
		});
		passwordField.onSpecialKeyPressed.addListener(specialKey -> {
			if (specialKey == SpecialKey.ENTER) {
				login();
			}
		});

		window = new Window();
		window.setHideTitleBar(true);
		window.setModal(true);
		window.setHeight(300);
		window.setWidth(470);
		window.setBodyBackgroundColor(Color.WHITE.withAlpha(0.8f));
		window.setContent(loginForm);

		elegantPanel = new ElegantPanel(loginForm);
		elegantPanel.setMaxContentWidth(400);
	}

	private void login() {
		String login = getLogin();
		String password = getPassword();
		if (login != null && !login.isEmpty() && password != null && !password.isEmpty()) {
			onLogin.fire(new LoginData(login, password));
		} else {
			setError();
		}
	}

	public void focusLogin() {
		loginField.focus();
	}

	public ElegantPanel getElegantPanel() {
		return elegantPanel;
	}

	public void showLoginWindow(int animationDuration) {
		window.show(animationDuration);
		focusLogin();
	}

	public void closeLoginWindow(int animationDuration) {
		window.close(animationDuration);
	}

	public Window getLoginWindow() {
		return window;
	}

	public static class LoginData {
		public String login;
		public String password;

		public LoginData(String login, String password) {
			this.login = login;
			this.password = password;
		}
	}

	public void setError() {
		errorField.setValue("<span style='font-size:120%;color:#961900'>" + sessionContext.getLocalized("ux.loginWindow.wrongUserNameOrPassword") + "</span>");
	}

	public void removeErrorMessage() {
		errorField.setValue("");
	}

	public String getLogin() {
		return loginField.getValue();
	}

	public String getPassword() {
		return passwordField.getValue();
	}

	public TextField getLoginField() {
		return loginField;
	}

	public PasswordField getPasswordField() {
		return passwordField;
	}

	public Button getLoginButton() {
		return loginButton;
	}

	public Button getRegisterButton() {
		return registerButton;
	}

	public Button getForgotPasswordButton() {
		return forgotPasswordButton;
	}

	public DisplayField getErrorField() {
		return errorField;
	}

	public DisplayField getHeaderField() {
		return headerField;
	}
}
