import System from 'system';

import {parseKeydConfig} from '../src/keydConfig.js';

let failures = 0;

function test(name, fn) {
    try {
        fn();
        print(`ok   ${name}`);
    } catch (e) {
        failures++;
        print(`FAIL ${name}\n     ${e.message}`);
    }
}

function assertEqual(actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`expected ${e}, got ${a}`);
}

const items = (text, layer) => parseKeydConfig(text).get(layer);

test('comment above a mapping is its label', () => {
    assertEqual(items('[leader]\n# Firefox\nf = C-A-S-f1\n', 'leader'),
        [{key: 'f', label: 'Firefox', nested: false}]);
});

test('label applies to the next mapping only', () => {
    assertEqual(items('[leader]\n# Firefox\nf = C-A-S-f1\nt = C-A-S-f2\n', 'leader'), [
        {key: 'f', label: 'Firefox', nested: false},
        {key: 't', label: 'C-A-S-f2', nested: false},
    ]);
});

test('blank line resets the label', () => {
    assertEqual(items('[leader]\n# Firefox\n\nf = C-A-S-f1\n', 'leader'),
        [{key: 'f', label: 'C-A-S-f1', nested: false}]);
});

test('non-mapping line resets the label', () => {
    assertEqual(items('[leader]\n# Firefox\ninclude common\nf = C-A-S-f1\n', 'leader'),
        [{key: 'f', label: 'C-A-S-f1', nested: false}]);
});

test('unlabelled mapping shows its raw action', () => {
    assertEqual(items('[leader]\nx = macro(C-c C-v)\n', 'leader'),
        [{key: 'x', label: 'macro(C-c C-v)', nested: false}]);
});

test('oneshot, toggle, swap and layer are nested', () => {
    const text = [
        '[leader]',
        '# Window stuff',
        'w = oneshot(window)',
        'n = toggle(nav)',
        's = swap(sym)',
        '# Numbers',
        'd = layer(num)',
    ].join('\n');
    assertEqual(items(text, 'leader'), [
        {key: 'w', label: 'Window stuff', nested: true},
        {key: 'n', label: 'nav', nested: true},
        {key: 's', label: 'sym', nested: true},
        {key: 'd', label: 'Numbers', nested: true},
    ]);
});

test('[name:mods] header maps to layer name', () => {
    const layers = parseKeydConfig('[nav:C]\n# Left\nh = left\n');
    assertEqual([...layers.keys()], ['nav']);
    assertEqual(layers.get('nav'), [{key: 'h', label: 'Left', nested: false}]);
});

test('multiple layers are kept apart', () => {
    const text = [
        '[ids]',
        '*',
        '',
        '[main]',
        'rightalt = oneshot(leader)',
        '',
        '[leader]',
        '# Firefox',
        'f = C-A-S-f1',
        '# Terminal',
        't = C-A-S-f2',
    ].join('\n');
    const layers = parseKeydConfig(text);
    assertEqual([...layers.keys()], ['ids', 'main', 'leader']);
    assertEqual(layers.get('ids'), []);
    assertEqual(layers.get('main'), [{key: 'rightalt', label: 'leader', nested: true}]);
    assertEqual(layers.get('leader'), [
        {key: 'f', label: 'Firefox', nested: false},
        {key: 't', label: 'Terminal', nested: false},
    ]);
});

test('header resets a pending label and comments before any header are ignored', () => {
    const layers = parseKeydConfig('# stray\nx = y\n[a]\n# dangling\n[b]\nk = v\n');
    assertEqual(layers.get('a'), []);
    assertEqual(layers.get('b'), [{key: 'k', label: 'v', nested: false}]);
});

test('empty text yields no layers', () => {
    assertEqual(parseKeydConfig('').size, 0);
});

if (failures) {
    print(`${failures} test(s) failed`);
    System.exit(1);
}
