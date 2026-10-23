// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const EVENT_RE = /^[+-]\S+$/;
const BACKOFF_MIN_S = 3;
const BACKOFF_MAX_S = 60;

/**
 * Runs `keyd listen` and reports `+layer` / `-layer` events, respawning it
 * with exponential backoff when it exits.
 */
export class KeydListener {
    /**
     * @param {(event: string) => void} onEvent called with each event line
     * @param {(message: string) => void} warn sink for diagnostics
     */
    constructor(onEvent, warn) {
        this._onEvent = onEvent;
        this._warn = warn;
        this._bin = null;
        this._proc = null;
        this._cancellable = null;
        this._retryId = 0;
        this._backoff = BACKOFF_MIN_S;
        this._warned = new Set();
        this._running = false;
    }

    start() {
        // Debian and Ubuntu ship the binary as keyd.rvaiya
        this._bin = GLib.find_program_in_path('keyd.rvaiya') ??
            GLib.find_program_in_path('keyd');
        if (!this._bin) {
            this._warn('keyd not found in PATH');
            return;
        }
        this._running = true;
        this._spawn();
    }

    stop() {
        this._running = false;
        if (this._retryId) {
            GLib.source_remove(this._retryId);
            this._retryId = 0;
        }
        this._killProcess();
    }

    _spawn() {
        let proc;
        try {
            proc = Gio.Subprocess.new([this._bin, 'listen'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE);
        } catch (e) {
            this._warnOnce(`failed to start ${this._bin} listen: ${e.message}`);
            this._scheduleRespawn();
            return;
        }

        this._proc = proc;
        this._cancellable = new Gio.Cancellable();
        const stream = new Gio.DataInputStream({
            base_stream: proc.get_stdout_pipe(),
            close_base_stream: true,
        });
        this._readLine(stream, this._cancellable);
    }

    _readLine(stream, cancellable) {
        stream.read_line_async(GLib.PRIORITY_DEFAULT, cancellable, (_s, res) => {
            // Closing is deferred to here because close() fails while a read is pending.
            if (cancellable !== this._cancellable) {
                closeStream(stream);
                return;
            }

            let line;
            try {
                [line] = stream.read_line_finish_utf8(res);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                    closeStream(stream);
                    return;
                }
                this._warnOnce(`reading keyd listen output failed: ${e.message}`);
                line = null;
            }

            if (line === null) {
                this._warnOnce('keyd listen exited; retrying with backoff');
                closeStream(stream);
                this._killProcess();
                this._scheduleRespawn();
                return;
            }

            this._handleLine(line.trim());
            this._readLine(stream, cancellable);
        });
    }

    _handleLine(line) {
        if (!line)
            return;
        if (EVENT_RE.test(line)) {
            this._backoff = BACKOFF_MIN_S;
            this._onEvent(line);
        } else {
            this._warnOnce(`keyd listen: ${line}`);
        }
    }

    _scheduleRespawn() {
        if (!this._running || this._retryId)
            return;
        const delay = this._backoff;
        this._backoff = Math.min(this._backoff * 2, BACKOFF_MAX_S);
        this._retryId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delay, () => {
            this._retryId = 0;
            this._spawn();
            return GLib.SOURCE_REMOVE;
        });
    }

    _killProcess() {
        this._cancellable?.cancel();
        this._cancellable = null;
        this._proc?.force_exit();
        this._proc = null;
    }

    _warnOnce(message) {
        if (this._warned.has(message))
            return;
        this._warned.add(message);
        this._warn(message);
    }
}

function closeStream(stream) {
    stream.close_async(GLib.PRIORITY_DEFAULT, null, (_s, res) => {
        try {
            stream.close_finish(res);
        } catch {
            // The process is already gone; nothing to recover.
        }
    });
}
