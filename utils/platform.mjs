/**
 * utils/platform.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: توفير معلومات المنصة الحالية.
 *
 * مستقلة تماماً (zero dependencies).
 * تُستخدم في: infrastructure/binary-manager.mjs
 */

/**
 * يُعيد اسم الثنائي المناسب للمنصة الحالية.
 * @param {"yt-dlp"} tool
 * @returns {string}
 */
export function getPlatformBinary(tool) {
  const { platform, arch } = process;

  if (tool === "yt-dlp") {
    if (platform === "linux"  && arch === "x64")   return "yt-dlp_linux";
    if (platform === "linux"  && arch === "arm64")  return "yt-dlp_linux_aarch64";
    if (platform === "darwin")                      return "yt-dlp_macos";
    if (platform === "win32")                       return "yt-dlp.exe";
    return "yt-dlp_linux"; // fallback
  }

  throw new Error(`أداة غير معروفة: ${tool}`);
}

/** معلومات المنصة الحالية (للتشخيص) */
export const platformInfo = Object.freeze({
  os:      process.platform,
  arch:    process.arch,
  node:    process.version,
  pid:     process.pid,
});
