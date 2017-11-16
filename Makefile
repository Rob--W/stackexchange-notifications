all: firefox chrome
.PHONY: firefox chrome

define mkicon
	inkscape -z -w "$2" -h "$2" se-logo.svg -e "$1icon$2.png"
	pngcrush -q -brute "$1icon$2.png"{,.} && mv "$1icon$2.png"{.,}
endef

chrome:
	cd Chrome && 7z u -tzip ../extension.zip *

# After copying the source from Chrome,
# remove unsupported keys (optional_permissions background),
# and add applications.gecko.id.
firefox:
	rsync -av Chrome/ Firefox/ --delete --exclude='.*' \
		--exclude=README.md \
		--exclude=storage-sync-polyfill.js
	cat Chrome/manifest.json | \
		tr '\n' '\t' | \
		sed 's/"localStorage-proxy.js"/"storage-sync-polyfill.js",\t            \0/' | \
		sed 's/"optional_permissions":[^]]\+][^"]\+//' | \
		sed 's/\]\t\}/],\t    "applications": {\t        "gecko": {\t            "id": "stackexchange-notifications@jetpack"\t        }\t    }\t}/' | \
		tr '\t' '\n' > Firefox/manifest.json
	cat Chrome/options.html | \
		tr '\n' '\t' | \
		sed 's/<script src="localStorage-proxy.js">/<script src="storage-sync-polyfill.js"><\/script>\t\0/' | \
		tr '\t' '\n' > Firefox/options.html
	cd Firefox && 7z u -tzip ../se-notifications.xpi

icons-chrome:
	$(call mkicon,Chrome/,19)
	$(call mkicon,Chrome/,38)
	$(call mkicon,Chrome/,48)

icons-firefox:
	# No 16x16 is generated because we use the favicon for that,
	# which is optimized for legibility at a small (16x16) size.
	$(call mkicon,Firefox/data/,32)

icons: icons-chrome icons-firefox

clean:
	rm -f extension.zip
	rm -f se-notifications.xpi
