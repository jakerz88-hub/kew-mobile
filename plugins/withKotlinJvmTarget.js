const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Forces all Android subprojects to compile Kotlin to JVM 17,
 * matching the Java compiler target used by the Expo build environment.
 * Fixes the JVM-target mismatch in expo-dynamic-app-icon and any other
 * third-party plugins that hardcode an older jvmTarget.
 *
 * Implementation note: the patch is appended to the END of the root
 * build.gradle, which runs AFTER `apply plugin: "com.facebook.react.rootproject"`
 * has already triggered subproject evaluation. That means `afterEvaluate`
 * fails with "Cannot run Project.afterEvaluate(Closure) when the project
 * is already evaluated." Instead we use:
 *   - `plugins.withId(...)` — reactive notifier that fires when the plugin
 *     is applied, or immediately if it has already been applied. No
 *     dependency on evaluation timing.
 *   - `tasks.withType(KotlinCompile).configureEach` — lazy task
 *     configuration that fires when a matching task is registered.
 *     Works for any task added before or after this block runs.
 */
module.exports = function withKotlinJvmTarget(config) {
  return withProjectBuildGradle(config, (mod) => {
    const patch = `
// JVM target alignment — applied by withKotlinJvmTarget config plugin
subprojects { subproject ->
    subproject.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            jvmTarget = "17"
        }
    }
    ["com.android.library", "com.android.application"].each { pluginId ->
        subproject.plugins.withId(pluginId) {
            subproject.android.compileOptions {
                sourceCompatibility JavaVersion.VERSION_17
                targetCompatibility JavaVersion.VERSION_17
            }
        }
    }
}
`;
    if (!mod.modResults.contents.includes("withKotlinJvmTarget config plugin")) {
      mod.modResults.contents += patch;
    }
    return mod;
  });
};
