// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class Overlay {
    /** @param {Gio.Settings} settings supplies max-rows, bottom-margin and hide-timeout */
    constructor(settings) {
        this._settings = settings;
        this._panel = null;
        this._timeoutId = 0;
    }

    /** @param {Array<{key: string, label: string, nested: boolean}>} items */
    show(title, items) {
        this.hide();
        if (!items.length)
            return;

        const maxRows = this._settings.get_int('max-rows');
        const bottomMargin = this._settings.get_int('bottom-margin');
        const hideTimeout = this._settings.get_int('hide-timeout');

        const panel = new St.BoxLayout({
            style_class: 'leader-hint',
            orientation: Clutter.Orientation.VERTICAL,
            reactive: false,
        });

        panel.add_child(new St.Label({text: title, style_class: 'leader-hint-title'}));

        const layout = new Clutter.GridLayout();
        const grid = new St.Widget({layout_manager: layout, style_class: 'leader-hint-grid'});
        layout.hookup_style(grid);

        items.forEach(({key, label, nested}, i) => {
            const row = new St.BoxLayout({style_class: 'leader-hint-item'});
            row.add_child(new St.Label({
                text: key,
                style_class: 'leader-hint-key',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            row.add_child(new St.Label({
                text: label,
                style_class: nested ? 'leader-hint-desc leader-hint-group' : 'leader-hint-desc',
                y_align: Clutter.ActorAlign.CENTER,
            }));

            layout.attach(row, Math.floor(i / maxRows), i % maxRows, 1, 1);
        });

        panel.add_child(grid);
        Main.layoutManager.uiGroup.add_child(panel);

        const monitor = Main.layoutManager.primaryMonitor;
        const [, natW] = panel.get_preferred_width(-1);
        const [, natH] = panel.get_preferred_height(natW);
        panel.set_position(
            Math.round(monitor.x + (monitor.width - natW) / 2),
            Math.round(monitor.y + monitor.height - natH - bottomMargin));

        panel.opacity = 0;
        panel.translation_y = 8;
        panel.ease({
            opacity: 255,
            translation_y: 0,
            duration: 90,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this._panel = panel;
        // Hides the panel if a release event is ever missed
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, hideTimeout, () => {
            this._timeoutId = 0;
            this.hide();
            return GLib.SOURCE_REMOVE;
        });
    }

    hide() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._panel?.destroy();
        this._panel = null;
    }

    destroy() {
        this.hide();
        this._settings = null;
    }
}
