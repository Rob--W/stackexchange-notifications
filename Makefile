all: firefox chrome
.PHONY: firefox chrome

chrome:
	cd Chrome && 7z u -tzip ../extension.zip *

firefox:
	# Note: Still using cfx instead of jpm because JPM is incompatible with
	# Firefox 37 and earlier
	cd /opt/addon-sdk && source bin/activate; cd - && cd Firefox && cfx xpi

clean:
	rm extension.zip
	rm Firefox/desktop-notifications-stack-exchange.xpi
