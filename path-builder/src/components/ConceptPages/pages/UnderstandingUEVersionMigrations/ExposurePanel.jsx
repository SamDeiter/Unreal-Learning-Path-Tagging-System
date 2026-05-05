/**
 * ExposurePanel — intentionally renders nothing in the post-Stitch redesign.
 *
 * Exposure data is now folded into the bento stats in HeroTimeline. This
 * component is preserved as a no-op so the composer's import/contract stays
 * stable.
 */
// eslint-disable-next-line no-unused-vars
export function ExposurePanel({ refs, exposure, totalAffected }) {
  return null;
}
