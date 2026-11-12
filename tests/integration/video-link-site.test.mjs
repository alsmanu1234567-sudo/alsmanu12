import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const YTDLP = process.env.YTDLP_PATH || join(ROOT, "bin", "yt-dlp");
const VIDEO_URL = process.env.LINK_VIDEO_TEST_URL || "";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36";
const QUALITY = {
  "3": { ceiling: 1080, crf: 22, audioBitrate: "128k" },
  "2": { ceiling: 720, crf: 27, audioBitrate: "96k" },
  "1": { ceiling: 480, crf: 31, audioBitrate: "80k" },
};
let infoPromise;
let mediaUrlPromise;

function validateInput() {
  assert.ok(VIDEO_URL, "Set LINK_VIDEO_TEST_URL to the user-provided video page.");
  const url = new URL(VIDEO_URL);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname.toLowerCase(), "ara.thexh.live");
  assert.match(url.pathname, /^\/videos\/[^/]+\/?$/);
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.ok(!url.port, "Non-default ports are not allowed.");
}

function runYtDlp(args, timeout = 180_000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      YTDLP,
      [
        "--ignore-config",
        "--no-warnings",
        "--no-progress",
        "--no-playlist",
        "--user-agent",
        USER_AGENT,
        "--referer",
        VIDEO_URL,
        "--js-runtimes",
        `node:${process.execPath}`,
        ...args,
        VIDEO_URL,
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error("yt-dlp timed out"));
    }, timeout);

    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolveRun({ stdout, stderr });
      const reason = /Unsupported URL/i.test(stderr)
        ? "unsupported source page"
        : /HTTP Error 403|HTTP 403/i.test(stderr)
          ? "source denied the request (403)"
          : /HTTP Error 404|HTTP 404/i.test(stderr)
            ? "source page was not found (404)"
            : /max-filesize|file is larger|filesize/i.test(stderr)
              ? "selected media exceeds the configured size limit"
              : `yt-dlp exited with ${code ?? signal ?? "unknown status"}`;
      rejectRun(new Error(reason));
    });
  });
}

function runCurl(args, timeout = 30_000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("curl", args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error("curl timed out"));
    }, timeout);
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", () => {
      clearTimeout(timer);
      rejectRun(new Error("curl could not start"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolveRun(stdout.trim());
      rejectRun(new Error(`curl exited with ${code ?? "unknown status"}`));
    });
  });
}

function runCommand(command, args, timeout = 180_000) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error(`${command} timed out`));
    }, timeout);
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", () => {
      clearTimeout(timer);
      rejectRun(new Error(`${command} could not start`));
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolveRun(stdout.trim());
      rejectRun(new Error(`${command} exited with ${code ?? signal ?? "unknown status"}`));
    });
  });
}

function parseJson(stdout) {
  for (const line of stdout.split(/\r?\n/).reverse()) {
    const candidate = line.trim();
    if (!candidate.startsWith("{")) continue;
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new Error("yt-dlp did not return JSON metadata");
}

function extractInfo() {
  if (!infoPromise) {
    infoPromise = runYtDlp(["--simulate", "--dump-single-json"])
      .then(({ stdout }) => parseJson(stdout));
  }
  return infoPromise;
}

function extractMediaUrl() {
  if (!mediaUrlPromise) {
    mediaUrlPromise = extractInfo().then((info) => {
      const mediaUrl = info.formats?.find((format) => format.url)?.url;
      assert.ok(mediaUrl, "The extractor did not return a media URL.");
      const parsed = new URL(mediaUrl);
      assert.ok(["https:", "http:"].includes(parsed.protocol));
      return mediaUrl;
    });
  }
  return mediaUrlPromise;
}

function summarize(info) {
  const formats = (info.formats || [])
    .slice(0, 20)
    .map((format) => ({
      formatId: format.format_id || null,
      height: Number.isFinite(format.height) ? format.height : null,
      ext: format.ext || null,
      protocol: format.protocol || null,
      videoCodec: format.vcodec || null,
      audioCodec: format.acodec || null,
      size: format.filesize ?? format.filesize_approx ?? null,
      hasDirectUrl: Boolean(format.url),
    }));
  return {
    extractor: info.extractor_key || info.extractor || "unknown",
    durationSeconds: Number.isFinite(info.duration) ? info.duration : null,
    formats,
    subtitleLanguages: Object.keys(info.subtitles || {}),
    automaticSubtitleLanguages: Object.keys(info.automatic_captions || {}),
  };
}

validateInput();

test("extracts metadata and available formats from the page", async () => {
  const info = await extractInfo();
  assert.ok(Array.isArray(info.formats) && info.formats.length > 0);
  console.log(`VIDEO_TEST_METADATA ${JSON.stringify(summarize(info))}`);
});

test("the public page responds without downloading media", async () => {
  const raw = await runCurl([
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "20",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}|%{content_type}|%{size_download}",
    "--user-agent",
    USER_AGENT,
    VIDEO_URL,
  ]);
  const [statusText, contentType, bytes] = raw.split("|");
  const signals = {
    status: Number(statusText),
    contentType: (contentType || "").split(";")[0],
    responseBytes: Number(bytes) || 0,
  };
  console.log(`VIDEO_TEST_PAGE ${JSON.stringify(signals)}`);
  assert.equal(signals.status, 200, "The page must return HTTP 200.");
});

test("the media endpoint accepts a small range request", async () => {
  const mediaUrl = await extractMediaUrl();
  const media = new URL(mediaUrl);
  assert.ok(["https:", "http:"].includes(media.protocol));
  const raw = await runCurl([
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "20",
    "--range",
    "0-0",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}|%{content_type}|%{size_download}",
    "--user-agent",
    USER_AGENT,
    "--referer",
    VIDEO_URL,
    mediaUrl,
  ]);
  const [statusText, contentType, bytes] = raw.split("|");
  const signals = {
    mediaHost: media.hostname,
    status: Number(statusText),
    contentType: (contentType || "").split(";")[0],
    responseBytes: Number(bytes) || 0,
  };
  console.log(`VIDEO_TEST_MEDIA ${JSON.stringify(signals)}`);
  assert.ok(
    [200, 206].includes(signals.status) &&
      (signals.contentType.startsWith("video/") ||
        signals.contentType === "application/octet-stream"),
    "The source did not return a playable media response.",
  );
});

test("downloads the direct MP4 and builds all three sendable quality profiles", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "video-link-test-"));
  const sourcePath = join(outputDir, "source.mp4");
  const maxBytes = 50 * 1024 * 1024;
  try {
    const mediaUrl = await extractMediaUrl();
    await runCurl(
      [
        "--silent",
        "--show-error",
        "--fail",
        "--location",
        "--max-time",
        "240",
        "--max-filesize",
        String(100 * 1024 * 1024),
        "--user-agent",
        USER_AGENT,
        "--referer",
        VIDEO_URL,
        "--output",
        sourcePath,
        mediaUrl,
      ],
      250_000,
    );
    const sourceStat = await stat(sourcePath);
    assert.ok(sourceStat.size > 5_000);
    assert.ok(sourceStat.size <= 100 * 1024 * 1024);
    const sourceProbe = JSON.parse(
      await runCommand(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=codec_type,codec_name,width,height,duration",
          "-of",
          "json",
          sourcePath,
        ],
        30_000,
      ),
    );
    const sourceVideo = sourceProbe.streams?.find((stream) => stream.codec_type === "video");
    assert.ok(sourceVideo?.height, "Downloaded MP4 has no readable video stream.");

    for (const [quality, profile] of Object.entries(QUALITY)) {
      const outputPath = join(outputDir, `quality-${quality}.mp4`);
      let outputStat = null;
      let usedCrf = profile.crf;
      for (; usedCrf <= 39; usedCrf += 4) {
        await runCommand(
          "ffmpeg",
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            sourcePath,
            "-vf",
            `scale=-2:min(${profile.ceiling}\\,ih)`,
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            String(usedCrf),
            "-c:a",
            "aac",
            "-b:a",
            profile.audioBitrate,
            "-movflags",
            "+faststart",
            outputPath,
          ],
          240_000,
        );
        outputStat = await stat(outputPath);
        if (outputStat.size <= maxBytes) break;
      }
      assert.ok(outputStat?.size <= maxBytes, `Quality ${quality} exceeds 50 MiB.`);
      const probe = JSON.parse(
        await runCommand(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,width,height",
            "-of",
            "json",
            outputPath,
          ],
          30_000,
        ),
      );
      const video = probe.streams?.find((stream) => stream.codec_type === "video");
      assert.ok(video?.height && video.height <= profile.ceiling);
      const sourceDuration = Number(sourceProbe.format?.duration || 0);
      const outputDuration = Number(probe.format?.duration || 0);
      if (sourceDuration > 0 && outputDuration > 0) {
        assert.ok(
          Math.abs(sourceDuration - outputDuration) <= 2,
          `Quality ${quality} output was truncated.`,
        );
      }
      console.log(
        `VIDEO_TEST_QUALITY ${quality} ${video.height}p ${outputStat.size}bytes crf=${usedCrf}`,
      );
    }
    console.log(
      `VIDEO_TEST_DOWNLOAD ${JSON.stringify({
        sourceBytes: sourceStat.size,
        sourceHeight: sourceVideo.height,
        hasAudio: Boolean(sourceProbe.streams?.some((stream) => stream.codec_type === "audio")),
      })}`,
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
