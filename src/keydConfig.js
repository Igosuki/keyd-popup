// SPDX-License-Identifier: GPL-2.0-or-later

const HEADER_RE = /^\[([^\]]*)\]$/;
const NESTED_RE = /^(?:oneshot|toggle|swap|layer)\(([^)]+)\)$/;

/**
 * Maps each layer name to its bindings. A `#` comment directly above a
 * mapping is its label; unlabelled mappings fall back to the raw action.
 *
 * @param {string} text contents of a keyd config file
 * @returns {Map<string, Array<{key: string, label: string, nested: boolean}>>}
 */
export function parseKeydConfig(text) {
    const layers = new Map();
    let items = null;
    let label = '';

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();

        const header = line.match(HEADER_RE);
        if (header) {
            // keyd allows a modifier suffix: [name:C-A]
            const name = header[1].split(':')[0].trim();
            items = layers.get(name);
            if (!items) {
                items = [];
                layers.set(name, items);
            }
            label = '';
            continue;
        }
        if (!items)
            continue;

        if (!line) {
            label = '';
            continue;
        }
        if (line.startsWith('#')) {
            label = line.slice(1).trim();
            continue;
        }

        const eq = line.indexOf('=');
        if (eq < 0) {
            label = '';
            continue;
        }
        const key = line.slice(0, eq).trim();
        const action = line.slice(eq + 1).trim();

        const nested = action.match(NESTED_RE);
        if (nested)
            items.push({key, label: label || nested[1].trim(), nested: true});
        else
            items.push({key, label: label || action, nested: false});
        label = '';
    }

    return layers;
}
