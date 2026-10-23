// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class KeydPopupPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const keydGroup = new Adw.PreferencesGroup({title: 'keyd'});
        page.add(keydGroup);

        const pathRow = new Adw.EntryRow({
            title: 'Config file',
            text: settings.get_string('config-path'),
            show_apply_button: true,
        });
        pathRow.connect('apply', () => settings.set_string('config-path', pathRow.text.trim()));
        keydGroup.add(pathRow);

        const ignoredRow = new Adw.EntryRow({
            title: 'Ignored layers (space separated)',
            text: settings.get_strv('ignored-layers').join(' '),
            show_apply_button: true,
        });
        ignoredRow.connect('apply', () =>
            settings.set_strv('ignored-layers', ignoredRow.text.split(/\s+/).filter(Boolean)));
        keydGroup.add(ignoredRow);

        const panelGroup = new Adw.PreferencesGroup({title: 'Panel'});
        page.add(panelGroup);

        const spinRows = [
            ['max-rows', 'Rows per column', 'Items before wrapping to a new column', 1, 30],
            ['bottom-margin', 'Bottom margin', 'Distance from the bottom of the primary monitor, in pixels', 0, 2000],
            ['hide-timeout', 'Hide timeout', 'Seconds before the panel hides if a release is missed', 1, 60],
        ];
        for (const [key, title, subtitle, lower, upper] of spinRows) {
            const row = new Adw.SpinRow({
                title,
                subtitle,
                adjustment: new Gtk.Adjustment({lower, upper, step_increment: 1, page_increment: 10}),
            });
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            panelGroup.add(row);
        }

        window.add(page);
    }
}
