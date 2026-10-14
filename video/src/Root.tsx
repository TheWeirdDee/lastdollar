import { Composition, Still } from 'remotion'
import { Demo } from './Demo'
import { Thumbnail } from './Thumbnail'
import plan from './plan.json'

const frames = Math.ceil(plan.duration * plan.fps)

export const RemotionRoot = () => (
  <>
    <Composition id="LastDollarDemo" component={Demo} durationInFrames={frames} fps={plan.fps} width={plan.width} height={plan.height} defaultProps={{ captions: true }} />
    <Composition id="LastDollarDemoClean" component={Demo} durationInFrames={frames} fps={plan.fps} width={plan.width} height={plan.height} defaultProps={{ captions: false }} />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
  </>
)
