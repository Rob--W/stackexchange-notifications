all: firefox chrome
.PHONY: firefox chrome

chrome:
	cd Chrome && 7z u -tzip ../extension.zip *

firefox:
	cd Firefox && jpm xpi

clean:
	rm extension.zip
