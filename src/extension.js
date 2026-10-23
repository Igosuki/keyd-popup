// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {parseKeydConfig} from './keydConfig.js';
import {KeydListener} from './keydListener.js';
import {Overlay} from './overlay.js';

const RELOAD_DELAY_MS = 250;

function warn(message) {
    console.warn(`[keyd-popup] ${message}`);
}

export default class KeydPopupExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._layers = new Map();
        this._current = null;
        this._overlay = new Overlay(this._settings);

        this._configPathChangedId = this._settings.connect('changed::config-path',
            () => this._watchConfig());
        this._watchConfig();

        this._listener = new KeydListener(event => this._onEvent(event), warn);
        this._listener.start();
    }

    disable() {
        this._listener?.stop();
        this._listener = null;

        this._unwatchConfig();

        if (this._configPathChangedId) {
            this._settings.disconnect(this._configPathChangedId);
            this._configPathChangedId = 0;
        }

        this._overlay?.destroy();
        this._overlay = null;
        this._settings = null;
        this._layers = null;
        this._current = null;
    }

    _onEvent(event) {
        const name = event.slice(1);
        if (this._settings.get_strv('ignored-layers').includes(name))
            return;

        if (event.startsWith('+')) {
            const items = this._layers.get(name);
            if (!items?.length)
                return;
            this._overlay.show(name, items);
            this._current = name;
        } else if (name === this._current) {
            // A nested layer may already have replaced the panel
            this._overlay.hide();
            this._current = null;
        }
    }

    _watchConfig() {
        this._unwatchConfig();

        const path = this._settings.get_string('config-path');
        this._configFile = Gio.File.new_for_path(path);
        this._configWarned = false;

        try {
            this._configMonitor = this._configFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._configMonitorId = this._configMonitor.connect('changed',
                (_monitor, _file, _other, eventType) => {
                    if (eventType !== Gio.FileMonitorEvent.ATTRIBUTE_CHANGED)
                        this._scheduleReload();
                });
        } catch (e) {
            warn(`cannot watch ${path}: ${e.message}`);
        }

        this._loadConfig();
    }

    _unwatchConfig() {
        if (this._reloadId) {
            GLib.source_remove(this._reloadId);
            this._reloadId = 0;
        }
        if (this._configMonitor) {
            this._configMonitor.disconnect(this._configMonitorId);
            this._configMonitor.cancel();
            this._configMonitor = null;
            this._configMonitorId = 0;
        }
        this._loadCancellable?.cancel();
        this._loadCancellable = null;
        this._configFile = null;
    }

    // Saves arrive as bursts of monitor events; coalesce them into one read.
    _scheduleReload() {
        if (this._reloadId)
            GLib.source_remove(this._reloadId);
        this._reloadId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RELOAD_DELAY_MS, () => {
            this._reloadId = 0;
            this._loadConfig();
            return GLib.SOURCE_REMOVE;
        });
    }

    _loadConfig() {
        this._loadCancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._loadCancellable = cancellable;
        const file = this._configFile;

        file.load_contents_async(cancellable, (_f, res) => {
            if (cancellable.is_cancelled())
                return;
            this._loadCancellable = null;

            try {
                const [, contents] = file.load_contents_finish(res);
                this._layers = parseKeydConfig(new TextDecoder().decode(contents));
                this._configWarned = false;
            } catch (e) {
                this._layers = new Map();
                if (!this._configWarned) {
                    this._configWarned = true;
                    warn(`cannot read ${file.get_path()}: ${e.message}`);
                }
            }
        });
    }
}
