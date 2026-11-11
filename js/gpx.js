// GPX export so runs can be opened in any mapping tool or kept as a plain-file backup.

export function toGPX(run) {
  const pts = run.points || [];
  const segs = run.segments?.length ? run.segments.filter((s) => s.length) : [pts.map((_, i) => i)];
  const trkpt = (i) => {
    const [lat, lon, t, alt] = pts[i];
    return `<trkpt lat="${lat}" lon="${lon}">${alt != null ? `<ele>${alt}</ele>` : ''}<time>${new Date(t).toISOString()}</time></trkpt>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Austin Half" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${(run.title || 'Run').replace(/[<&]/g, '')} ${run.date}</name><type>running</type>
${segs.map((s) => `<trkseg>${s.map(trkpt).join('')}</trkseg>`).join('\n')}
</trk></gpx>`;
}
