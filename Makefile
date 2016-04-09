all: firefox chrome
.PHONY: firefox chrome

define mkicon
	inkscape -z -w "$2" -h "$2" se-logo.svg -e "$1icon$2.png"
	pngcrush -q -brute "$1icon$2.png"{,.} && mv "$1icon$2.png"{.,}
endef

chrome:
	cd Chrome && 7z u -tzip ../extension.zip *

firefox:
	cd Firefox && jpm xpi

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
	rm extension.zip
