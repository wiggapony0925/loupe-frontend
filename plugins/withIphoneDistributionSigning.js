/**
 * Pin Release code signing to the "iPhone Distribution" identity class.
 *
 * Why: EAS remote credentials for this app hold an "iPhone Distribution:
 * Jeffrey Fernandez" certificate, and the provisioning profile only embeds
 * that cert. On LOCAL eas builds, this Mac's login keychain also contains a
 * newer "Apple Distribution: Jeffrey Fernandez" identity (created by Xcode),
 * and Xcode preferred it — then failed with "provisioning profile doesn't
 * include signing certificate".
 *
 * Pinning the identity NAME CLASS makes Xcode consider only certs whose CN
 * starts with "iPhone Distribution", i.e. exactly the EAS-injected cert.
 * Cloud builders only ever see the EAS cert, so this is a no-op there.
 *
 * NOTE: if the EAS distribution certificate is ever rotated to one named
 * "Apple Distribution: …", update or delete this plugin.
 */
const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withIphoneDistributionSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const section = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(section)) {
      const entry = section[key];
      if (!entry || typeof entry !== "object" || !entry.buildSettings) continue;
      if (entry.name !== "Release") continue;
      entry.buildSettings.CODE_SIGN_IDENTITY = '"iPhone Distribution"';
      entry.buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] =
        '"iPhone Distribution"';
    }
    return cfg;
  });
};
