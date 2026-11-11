import { Composition, Still } from "remotion";
import { HERO_SIZE, Hero, REPORT_SIZE, ReportExample } from "./Stills";
import { FPS, TOTAL, Tutorial } from "./Tutorial";

export const Root: React.FC = () => (
  <>
    <Composition id="Tutorial" component={Tutorial} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Still id="Hero" component={Hero} {...HERO_SIZE} />
    <Still id="ReportExample" component={ReportExample} {...REPORT_SIZE} />
  </>
);
