// Preserve the complete export; resolve only the active profile for the preview.
export function cleanXtool(raw) {
  try {
    const json = typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (json.length > 500000) return null;
    const data = JSON.parse(json);
    if (data?.format !== 'xtool-studio-processing-settings' || data.version !== 1
        || !data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) return null;
    const graph = data.payload.displayData?.graph;
    if (graph && (!Array.isArray(graph.profiles) || !Array.isArray(graph.patches)
        || !Array.isArray(graph.activeBinding?.patchIds)
        || graph.profiles.some(item => !item || typeof item !== 'object')
        || graph.patches.some(item => !item || typeof item !== 'object'))) return null;
    return data;
  } catch { return null; }
}

export function xtoolSummary(data) {
  const p = data.payload, graph = p.displayData?.graph, binding = graph?.activeBinding;
  const profile = graph?.profiles?.find(item => item.id === binding?.baseProfileId);
  const values = { ...profile?.values };
  for (const id of binding?.patchIds || []) {
    const patch = graph?.patches?.find(item => item.id === id);
    if (patch && patch.profileId === profile?.id) Object.assign(values, patch.overrides);
  }
  const modes = { FILL_VECTOR_ENGRAVING: 'Gravure de remplissage', VECTOR_CUTTING: 'Découpe vectorielle', BITMAP_ENGRAVING: 'Gravure d’image' };
  const type = graph?.processingType || p.processingTypes?.[0];
  const device = p.deviceCode === 'GS002' ? 'F1 Ultra' : p.deviceCode;
  const lines = ['xTool · ' + (device || 'Paramètres'), modes[type] || type];
  const add = (label, value, unit = '') => {
    if (typeof value === 'number' && Number.isFinite(value)) lines.push(label + ' : ' + value + unit);
  };
  if (typeof values.processingLightSource === 'string') {
    const sources = { blue: 'Diode', red: 'Fibre' };
    lines.push('Source laser : ' + (sources[values.processingLightSource] || values.processingLightSource));
  }
  if (p.displayData?.ignored === true) lines.push('Traitement : Ignoré');
  add('Puissance', values.power, ' %');
  add('Vitesse', values.speed);
  add('Passages', values.repeat);
  add('DPI', values.dpi);
  if (type === 'BITMAP_ENGRAVING') {
    if (typeof values.bitmapMode === 'string') lines.push('Tramage : ' + (values.bitmapMode === 'grayscale' ? 'Niveaux de gris' : values.bitmapMode));
    if (typeof values.bitmapEngraveMode === 'string') lines.push('Mode : ' + (values.bitmapEngraveMode === 'dot' ? 'Point par point' : values.bitmapEngraveMode));
    if (values.bitmapEngraveMode === 'dot') add('Durée du point', values.dotDuration);
    add('Fréquence', values.frequency);
    const range = values.powerMinMaxRange;
    if (Array.isArray(range) && range.length === 2 && range.every(value => typeof value === 'number' && Number.isFinite(value))) lines.push('Plage puissance : ' + range.join('–') + ' %');
  }
  add('Épaisseur', p.modeData?.thickness, ' mm');
  return lines.filter(value => typeof value === 'string').map(value => value.slice(0, 150)).join('\n');
}
