/**
 * Pin Release code signing to the EAS distribution certificate by SHA-1.
 *
 * Why: EAS remote credentials for this app hold the "iPhone Distribution:
 * Jeffrey Fernandez (DCU7GHRVUQ)" certificate, and the stored provisioning
 * profile only embeds that cert. This Mac's login keychain ALSO contains a
 * newer "Apple Distribution: Jeffrey Fernandez" identity (created by Xcode),
 * and on LOCAL eas builds Xcode preferred it — failing the archive with
 * "provisioning profile doesn't include signing certificate".
 *
 * Name-class pinning ("iPhone Distribution") does NOT fix this: Xcode
 * treats "iPhone Distribution" and "Apple Distribution" as the same
 * distribution identity class. Pinning the certificate's SHA-1 fingerprint
 * selects exactly one cert, everywhere. Cloud builders only have this cert
 * in their keychain, so the pin is a no-op there.
 *
 * NOTE: if the EAS distribution certificate is rotated, refresh this hash
 * (serial 3D6EEC92D7D32737B6514DBFE50B454, expires 2027-05-26) or delete
 * the plugin.
 */
const { withXcodeProject } = require("expo/config-plugins");

// SHA-1 fingerprint of the EAS "iPhone Distribution: Jeffrey Fernandez
// (DCU7GHRVUQ)" certificate.
const EAS_DIST_CERT_SHA1 = "B3E8D07B46BF295656BFEDA8C235CD1840485960";

module.exports = function withIphoneDistributionSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const section = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(section)) {
      const entry = section[key];
      if (!entry || typeof entry !== "object" || !entry.buildSettings) continue;
      if (entry.name !== "Release") continue;
      entry.buildSettings.CODE_SIGN_IDENTITY = `"${EAS_DIST_CERT_SHA1}"`;
      entry.buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] =
        `"${EAS_DIST_CERT_SHA1}"`;
    }
    return cfg;
  });
};
