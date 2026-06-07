const {
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require("@expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");
const fs = require("fs");
const path = require("path");

/**
 * Adds the missing iPad-sized PNGs (152x152 and 167x167) for every
 * alternate icon registered by expo-dynamic-app-icon, and references
 * them in CFBundleIcons~ipad.
 *
 * Why this exists: expo-dynamic-app-icon (v1.2.0) hardcodes iOS to
 * iPhone-only sizes — it generates 120x120 (@2x) and 180x180 (@3x)
 * PNGs per alternate icon, then registers the SAME iPhone basenames
 * in both CFBundleIcons and CFBundleIcons~ipad. ASC's validator
 * checks for the literal 152x152 and 167x167 PNGs in the bundle and
 * reports them missing (ITMS-90892) for every theme variant. iOS
 * upscales the iPhone icons at runtime so the app looks fine; the
 * warning is cosmetic ASC noise that fires on every submission.
 *
 * This plugin must run AFTER expo-dynamic-app-icon — register it
 * after that entry in app.json's plugins array. It piggybacks on the
 * DynamicAppIcons folder and CFBundleAlternateIcons dictionary the
 * parent plugin creates.
 *
 * Source images are read from ./assets/icons/<name>.png by convention
 * (matches the keys in expo-dynamic-app-icon's props). If the source
 * file is missing for a given key, that key is skipped with a warning.
 */

const iosFolderName = "DynamicAppIcons";

const IPAD_SIZES = [
  { label: "76x76", scale: 2, px: 152 },
  { label: "83.5x83.5", scale: 2, px: 167 },
];

function getIpadIconFileName(key, label, scale) {
  return `${key}-Icon-${label}@${scale}x.png`;
}

function getIpadIconBaseName(key, label) {
  return `${key}-Icon-${label}`;
}

function getAlternateIconKeys(config) {
  const plist = config.modResults;
  const fromIphone =
    plist?.CFBundleIcons?.CFBundleAlternateIcons &&
    Object.keys(plist.CFBundleIcons.CFBundleAlternateIcons);
  const fromIpad =
    plist?.["CFBundleIcons~ipad"]?.CFBundleAlternateIcons &&
    Object.keys(plist["CFBundleIcons~ipad"].CFBundleAlternateIcons);
  return fromIphone || fromIpad || [];
}

function withIpadIconImages(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const keys = readKeysFromPluginsProp(config);
      if (!keys || keys.length === 0) {
        console.warn(
          "[withIpadAlternateIcons] No expo-dynamic-app-icon entry found in plugins — skipping."
        );
        return config;
      }
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName
      );
      const outDir = path.join(iosRoot, iosFolderName);
      if (!fs.existsSync(outDir)) {
        console.warn(
          "[withIpadAlternateIcons] DynamicAppIcons directory missing — " +
            "expo-dynamic-app-icon must run before this plugin."
        );
        return config;
      }
      for (const { key, src } of keys) {
        const absSrc = path.isAbsolute(src) ? src : path.join(projectRoot, src);
        if (!fs.existsSync(absSrc)) {
          console.warn(
            `[withIpadAlternateIcons] Source image not found for "${key}" at ${absSrc} — skipping.`
          );
          continue;
        }
        for (const { label, scale, px } of IPAD_SIZES) {
          const fileName = getIpadIconFileName(key, label, scale);
          const { source } = await generateImageAsync(
            {
              projectRoot,
              cacheType: "kew-ipad-alt-icons",
            },
            {
              name: fileName,
              src: absSrc,
              removeTransparency: true,
              backgroundColor: "#ffffff",
              resizeMode: "cover",
              width: px,
              height: px,
            }
          );
          await fs.promises.writeFile(path.join(outDir, fileName), source);
        }
      }
      return config;
    },
  ]);
}

function withIpadIconXcodeProject(config) {
  return withXcodeProject(config, async (config) => {
    const keys = readKeysFromPluginsProp(config);
    if (!keys || keys.length === 0) return config;
    const groupPath = `${config.modRequest.projectName}/${iosFolderName}`;
    const group = IOSConfig.XcodeUtils.ensureGroupRecursively(
      config.modResults,
      groupPath
    );
    for (const { key } of keys) {
      for (const { label, scale } of IPAD_SIZES) {
        const fileName = getIpadIconFileName(key, label, scale);
        const alreadyAdded = group?.children?.some(
          ({ comment }) => comment === fileName
        );
        if (alreadyAdded) continue;
        config.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: path.join(groupPath, fileName),
          groupName: groupPath,
          project: config.modResults,
          isBuildFile: true,
          verbose: false,
        });
      }
    }
    return config;
  });
}

function withIpadIconInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    const altIconKeys = getAlternateIconKeys(config);
    if (altIconKeys.length === 0) {
      console.warn(
        "[withIpadAlternateIcons] CFBundleAlternateIcons not found — " +
          "ensure expo-dynamic-app-icon runs before this plugin in app.json."
      );
      return config;
    }
    if (!config.modResults["CFBundleIcons~ipad"]) {
      config.modResults["CFBundleIcons~ipad"] = {};
    }
    const ipadPlist = config.modResults["CFBundleIcons~ipad"];
    const sourceAltIcons =
      ipadPlist.CFBundleAlternateIcons ??
      config.modResults?.CFBundleIcons?.CFBundleAlternateIcons ??
      {};
    const updated = {};
    for (const key of altIconKeys) {
      const entry = sourceAltIcons[key] ?? {};
      const existingFiles = Array.isArray(entry.CFBundleIconFiles)
        ? entry.CFBundleIconFiles
        : [];
      const ipadBaseNames = IPAD_SIZES.map(({ label }) =>
        getIpadIconBaseName(key, label)
      );
      const merged = [...new Set([...existingFiles, ...ipadBaseNames])];
      updated[key] = {
        ...entry,
        CFBundleIconFiles: merged,
      };
    }
    ipadPlist.CFBundleAlternateIcons = updated;
    if (!ipadPlist.CFBundlePrimaryIcon) {
      ipadPlist.CFBundlePrimaryIcon = {
        CFBundleIconFiles: ["AppIcon"],
      };
    }
    return config;
  });
}

function readKeysFromPluginsProp(config) {
  const plugins = config?.plugins ?? [];
  for (const entry of plugins) {
    if (!Array.isArray(entry)) continue;
    if (entry[0] !== "expo-dynamic-app-icon") continue;
    const props = entry[1];
    if (!props || typeof props !== "object") return null;
    if (Array.isArray(props)) {
      return props.map((src, i) => ({
        key: String(i),
        src: typeof src === "string" ? src : src?.image,
      }));
    }
    return Object.entries(props).map(([key, val]) => ({
      key,
      src: typeof val === "string" ? val : val?.image,
    }));
  }
  return null;
}

module.exports = function withIpadAlternateIcons(config) {
  config = withIpadIconImages(config);
  config = withIpadIconXcodeProject(config);
  config = withIpadIconInfoPlist(config);
  return config;
};
