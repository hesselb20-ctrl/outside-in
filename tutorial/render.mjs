// Renders everything in /media that comes from the Remotion project:
//   hero.png, report-example.png, tutorial.mp4, preview.gif
//
//   npm run render            all of the above
//   npm run stills            only the two PNGs
//
// The video is rendered as a PNG sequence and encoded with ffmpeg (which must be on PATH),
// so the colours in the MP4 match the design tokens exactly.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, "..", "media");
const frames = join(here, "out", "frames");
const stillsOnly = process.argv.includes("--stills-only");
// Anything else on the command line is passed through to Remotion, e.g. --browser-executable=... or --concurrency=4.
const extra = process.argv.slice(2).filter((arg) => arg !== "--stills-only");

const run = (cmd, args) => execFileSync(cmd, args, { cwd: here, stdio: "inherit", shell: process.platform === "win32" });
const remotion = (...args) => run("npx", ["remotion", ...args, ...extra]);

mkdirSync(media, { recursive: true });
remotion("still", "src/index.ts", "Hero", join(media, "hero.png"));
remotion("still", "src/index.ts", "ReportExample", join(media, "report-example.png"));
if (stillsOnly) process.exit(0);

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
remotion("render", "src/index.ts", "Tutorial", frames, "--sequence", "--image-format=png");

const colour = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p";
run("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", "30", "-i", `"${join(frames, "element-%04d.png")}"`,
  "-vf", `"${colour}"`, "-c:v", "libx264", "-preset", "slow", "-crf", "18",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart",
  `"${join(media, "tutorial.mp4")}"`,
]);

// README preview: the whole story at 2x speed, 800 px wide, 10 fps, with a tuned palette.
const gif = "setpts=PTS/2,fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
run("ffmpeg", ["-y", "-loglevel", "error", "-i", `"${join(media, "tutorial.mp4")}"`, "-filter_complex", `"${gif}"`, `"${join(media, "preview.gif")}"`]);

console.log("Rendered hero.png, report-example.png, tutorial.mp4 and preview.gif into /media");
