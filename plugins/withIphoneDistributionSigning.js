/**
 * Release code signing, resolved per build environment.
 *
 * ON EAS (process.env.EAS_BUILD is set)
 *   Pin Release signing to the EAS distribution certificate by SHA-1.
 *   EAS remote credentials for this app hold the "iPhone Distribution:
 *   Jeffrey Fernandez (DCU7GHRVUQ)" certificate, and the stored provisioning
 *   profile only embeds that cert. Name-class pinning ("iPhone Distribution")
 *   does NOT work: Xcode treats "iPhone Distribution" and "Apple Distribution"
 *   as the same identity class. Pinning the SHA-1 selects exactly one cert.
 *
 *   NOTE: if the EAS distribution certificate is rotated, refresh this hash
 *   (serial 3D6EEC92D7D32737B6514DBFE50B454, expires 2027-05-26).
 *
 * LOCALLY (the default now — see scripts/build-ios-local.sh)
 *   Hand signing to Xcode. The EAS certificate's private key does NOT exist
 *   in this Mac's login keychain — only "Apple Development" and "Apple
 *   Distribution: Jeffrey Fernandez" do — so the SHA-1 pin above would fail
 *   every local archive with "no signing certificate matching ... found".
 *   Automatic signing lets Xcode select the local Apple Distribution identity
 *   and mint/refresh a matching App Store provisioning profile on demand
 *   (xcodebuild is invoked with -allowProvisioningUpdates).
 */
const { withXcodeProject } = require("expo/config-plugins");

// SHA-1 fingerprint of the EAS "iPhone Distribution: Jeffrey Fernandez
// (DCU7GHRVUQ)" certificate. Only present in EAS's build keychain.
const EAS_DIST_CERT_SHA1 = "B3E8D07B46BF295656BFEDA8C235CD1840485960";

const APPLE_TEAM_ID = "DCU7GHRVUQ";

module.exports = function withIphoneDistributionSigning(config) {
  const onEas = !!process.env.EAS_BUILD;

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const section = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(section)) {
      const entry = section[key];
      if (!entry || typeof entry !== "object" || !entry.buildSettings) continue;
      if (entry.name !== "Release") continue;

      if (onEas) {
        entry.buildSettings.CODE_SIGN_IDENTITY = `"${EAS_DIST_CERT_SHA1}"`;
        entry.buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] =
          `"${EAS_DIST_CERT_SHA1}"`;
      } else {
        entry.buildSettings.CODE_SIGN_STYLE = "Automatic";
        entry.buildSettings.DEVELOPMENT_TEAM = APPLE_TEAM_ID;
        // Automatic signing means Xcode picks BOTH the identity and the
        // profile. Naming an identity here as well is not a hint, it's a
        // contradiction, and the archive dies before it compiles anything:
        //
        //   error: Loupe has conflicting provisioning settings. Loupe is
        //   automatically signed for development, but a conflicting code
        //   signing identity Apple Distribution has been manually specified.
        //
        // So these are cleared rather than set. Xcode resolves the App Store
        // distribution identity itself from the archive's Release config and
        // the exportOptions method, with -allowProvisioningUpdates free to
        // mint or refresh the profile.
        delete entry.buildSettings.CODE_SIGN_IDENTITY;
        delete entry.buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'];
        // A stale pinned specifier would re-select the unusable EAS profile
        // sitting in ~/Library.
        delete entry.buildSettings.PROVISIONING_PROFILE_SPECIFIER;
        delete entry.buildSettings.PROVISIONING_PROFILE;
      }
    }
    return cfg;
  });
};
