#!/bin/bash
echo "Building Firefox add-on"
if ! cfx xpi ; then
    echo "Failed to run 'cfx xpi'. Did you set up the environment using addon-sdk?"
    echo "See https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/installation.html"
    exit
fi
echo "Backing up previous version of install.rdf"
mv install.rdf install.rdf.bak

echo "Reading minVersion and maxVersion from install.rdf"
minVersionPattern='\s*<em:minVersion>[^<]+<\/em:minVersion>'
maxVersionPattern='\s*<em:maxVersion>[^<]+<\/em:maxVersion>'
minVersion=$(awk "/${minVersionPattern}/" install.rdf.bak)
maxVersion=$(awk "/${maxVersionPattern}/" install.rdf.bak)

echo "Getting install.rdf from xpi"
7z x desktop-notifications-stack-exchange.xpi install.rdf > /dev/null

echo "Updating minVersion and maxVersion in install.rdf"
sed -E "s#${minVersionPattern}#${minVersion}#" -i install.rdf
sed -E "s#${maxVersionPattern}#${maxVersion}#" -i install.rdf

echo "Updating install.rdf in the xpi"
7z d desktop-notifications-stack-exchange.xpi install.rdf > /dev/null
7z a desktop-notifications-stack-exchange.xpi install.rdf > /dev/null
echo "Done!"
echo "Version $(grep -Pow '[0-9.]+(?=<\/em:version)' install.rdf)"
echo "minVersion ${minVersion}"
echo "maxVersion ${maxVersion}"
