UUID := keyd-popup@igosuki.github.io
ZIP := dist/$(UUID).shell-extension.zip
EXTRA_SOURCES := overlay.js keydListener.js keydConfig.js

.PHONY: pack install test clean

pack:
	mkdir -p dist
	gnome-extensions pack src --force --out-dir dist \
		$(addprefix --extra-source=,$(EXTRA_SOURCES)) \
		--schema=schemas/org.gnome.shell.extensions.keyd-popup.gschema.xml

install: pack
	gnome-extensions install --force $(ZIP)

test:
	gjs -m tests/keydConfig.test.js

clean:
	rm -rf dist src/schemas/gschemas.compiled
