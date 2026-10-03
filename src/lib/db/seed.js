// A realistic garden to try the app with in development (brief section 18).
// It goes through the normal write functions, so it is validated and logged
// like anything typed in. Days are counted back from today, so the timeline
// always looks recent. Its photos are drawn rather than stored, so no image
// files live in the repository.

import { createEntry } from './entries.js';
import { createGarden } from './gardens.js';
import { createIssue, setIssueStatus } from './issues.js';
import { createPlant } from './plants.js';
import { localDate } from '../dates.js';
import { processPhoto } from '../images.js';

const GARDEN = {
  name: 'Sample garden',
  soil: 'Clay loam',
  aspect: 'South-west',
  notes: 'Sample data for trying the app. Delete it from Garden details.'
};

const PLANTS = [
  { commonName: 'Rose', botanicalName: 'Rosa', variety: 'Gertrude Jekyll', location: 'Front border', planted: 900, source: 'Garden centre', careNotes: 'Deadhead through summer. Feed in March and again after the first flush.', tags: ['scented'] },
  { commonName: 'Lavender', botanicalName: 'Lavandula angustifolia', variety: 'Hidcote', location: 'Front border', quantity: 5, planted: 500, careNotes: 'Cut back by a third after flowering, never into old wood.', tags: ['scented', 'bees'] },
  { commonName: 'Daffodils', botanicalName: 'Narcissus', variety: 'Tête-à-tête', location: 'Front border', quantity: 40, status: 'dormant' },
  { commonName: 'Box hedge', botanicalName: 'Buxus sempervirens', location: 'Front path', quantity: 12, careNotes: 'Check inside the hedge for caterpillars from April.' },
  { commonName: 'Hydrangea', botanicalName: 'Hydrangea arborescens', variety: 'Annabelle', location: 'Shed corner' },
  { commonName: 'Foxgloves', botanicalName: 'Digitalis purpurea', location: 'Shed corner', quantity: 6, source: 'From seed', tags: ['bees'] },
  { commonName: 'Clematis', botanicalName: 'Clematis montana', variety: 'Elizabeth', location: 'Back fence' },
  { commonName: 'Raspberries', botanicalName: 'Rubus idaeus', variety: 'Autumn Bliss', location: 'Back fence', quantity: 8, tags: ['fruit'] },
  { commonName: 'Gooseberry', botanicalName: 'Ribes uva-crispa', variety: 'Invicta', location: 'Back fence', tags: ['fruit'] },
  { commonName: 'Sweet peas', botanicalName: 'Lathyrus odoratus', variety: 'Matucana', location: 'Back fence', status: 'removed', planted: 160, source: 'From seed', tags: ['scented'] },
  { commonName: 'Apple tree', botanicalName: 'Malus domestica', variety: 'Egremont Russet', location: 'Lawn', planted: 2200, careNotes: 'Winter prune in January.', tags: ['fruit'] },
  { commonName: 'Dahlia', botanicalName: 'Dahlia', variety: 'Café au Lait', location: 'Back border', quantity: 3, planted: 140 },
  { commonName: 'Peony', botanicalName: 'Paeonia lactiflora', variety: 'Sarah Bernhardt', location: 'Back border', status: 'dormant' },
  { commonName: 'Hosta', botanicalName: 'Hosta', variety: 'Sum and Substance', location: 'Pond edge' },
  { commonName: 'Male fern', botanicalName: 'Dryopteris filix-mas' },
  { commonName: 'Runner beans', botanicalName: 'Phaseolus coccineus', variety: 'Scarlet Emperor', location: 'Veg bed 1', quantity: 10, planted: 125, source: 'From seed', tags: ['veg'] },
  { commonName: 'Leeks', botanicalName: 'Allium porrum', variety: 'Musselburgh', location: 'Veg bed 1', quantity: 24, planted: 100, tags: ['veg'] },
  { commonName: 'Courgette', botanicalName: 'Cucurbita pepo', variety: 'Defender', location: 'Veg bed 2', quantity: 2, planted: 128, tags: ['veg'] },
  { commonName: 'Strawberries', botanicalName: 'Fragaria × ananassa', variety: 'Cambridge Favourite', location: 'Veg bed 2', quantity: 12, planted: 480, tags: ['fruit'] },
  { commonName: 'Tomatoes', botanicalName: 'Solanum lycopersicum', variety: 'Sungold', location: 'Greenhouse', quantity: 6, planted: 135, careNotes: 'Pinch out side shoots. Feed weekly once the first truss sets.', tags: ['veg'] },
  { commonName: 'Basil', botanicalName: 'Ocimum basilicum', location: 'Greenhouse', status: 'dead', planted: 110, tags: ['herbs'] },
  { commonName: 'Rosemary', botanicalName: 'Salvia rosmarinus', location: 'Herb bed', tags: ['herbs'] },
  { commonName: 'Mint', botanicalName: 'Mentha spicata', location: 'Patio pots', tags: ['herbs'] },
  { commonName: 'Japanese maple', botanicalName: 'Acer palmatum', variety: 'Bloodgood', location: 'Patio pots' },
  { commonName: 'Fuchsia', botanicalName: 'Fuchsia', variety: 'Swingtime', location: 'Hanging basket', status: 'removed' }
];

// Open and watching issues make their plants need attention
const ISSUES = [
  { plant: 'Hosta', title: 'Slug damage on leaves', kind: 'pest', severity: 'medium', firstSeen: 40, status: 'open', notes: 'Worst after rain. Holes all over the outer leaves.' },
  { plant: 'Box hedge', title: 'Box tree caterpillar', kind: 'pest', severity: 'high', firstSeen: 12, status: 'open', notes: 'Webbing inside the hedge by the gate.' },
  { plant: 'Courgette', title: 'Powdery mildew', kind: 'disease', severity: 'medium', firstSeen: 20, status: 'open' },
  { plant: 'Rose', title: 'Black spot', kind: 'disease', severity: 'medium', firstSeen: 64, status: 'watching', notes: 'Lower leaves only so far.' },
  { plant: 'Apple tree', title: 'Branch split in the wind', kind: 'weather', severity: 'low', firstSeen: 26, status: 'watching' },
  { plant: 'Tomatoes', title: 'Blossom end rot', kind: 'deficiency', severity: 'low', firstSeen: 52, status: 'resolved' },
  { plant: 'Gooseberry', title: 'Sawfly larvae', kind: 'pest', severity: 'high', firstSeen: 112, status: 'resolved' },
  { plant: 'Japanese maple', title: 'Scorched leaf edges', kind: 'damage', severity: 'low', firstSeen: 70, status: 'resolved', notes: 'Afternoon sun on the patio.' }
];

const ENTRIES = [
  { plant: 'Dahlia', days: 140, kind: 'planted', note: 'Tubers out of the shed. Staked at planting.', photos: 1 },
  { plant: 'Tomatoes', days: 135, kind: 'planted', note: 'Six plants into the greenhouse border.', photos: 1 },
  { plant: 'Courgette', days: 128, kind: 'planted' },
  { plant: 'Runner beans', days: 125, kind: 'planted', note: 'Two seeds to each cane.' },
  { plant: 'Rose', days: 118, kind: 'pruned', note: 'Deadheaded after the first flush.', photos: 2 },
  { plant: 'Rose', days: 116, kind: 'fed', product: 'Rose feed' },
  { plant: 'Strawberries', days: 115, kind: 'harvested', note: 'Last of the crop.' },
  { plant: 'Gooseberry', days: 111, kind: 'treated', note: 'Picked the larvae off by hand, about forty.', issue: 'Sawfly larvae', photos: 1 },
  { plant: 'Basil', days: 110, kind: 'planted' },
  { plant: 'Tomatoes', days: 105, kind: 'fed', product: 'Tomorite' },
  { plant: 'Leeks', days: 100, kind: 'planted', note: 'Dibbed in and watered, not firmed.' },
  { plant: 'Sweet peas', days: 100, kind: 'harvested', note: 'A vase every few days.', photos: 2 },
  { plant: 'Gooseberry', days: 98, kind: 'checked', note: 'No new larvae.', issue: 'Sawfly larvae' },
  { plant: 'Lavender', days: 95, kind: 'harvested', note: 'Bunches drying in the shed.', photos: 3 },
  { plant: 'Tomatoes', days: 91, kind: 'fed', product: 'Tomorite' },
  { plant: 'Gooseberry', days: 90, kind: 'harvested', note: 'About 2kg, mostly for jam.', photos: 1 },
  { plant: 'Foxgloves', days: 90, kind: 'other', note: 'Left the spikes to self-seed.' },
  { plant: 'Rosemary', days: 85, kind: 'pruned', note: 'Light trim to keep it bushy.' },
  { plant: 'Strawberries', days: 80, kind: 'other', note: 'Pegged runners into pots for new plants.' },
  { plant: 'Tomatoes', days: 77, kind: 'fed', product: 'Tomorite' },
  { plant: 'Courgette', days: 75, kind: 'harvested', note: 'Too many again. Gave a bag next door.', photos: 2 },
  { plant: 'Lavender', days: 70, kind: 'pruned', note: 'Cut back after flowering.' },
  { plant: 'Japanese maple', days: 69, kind: 'moved', note: 'Pot moved behind the shed, out of the afternoon sun.', issue: 'Scorched leaf edges', photos: 1 },
  { plant: 'Mint', days: 66, kind: 'moved', note: 'Split and repotted. The roots had filled the pot.' },
  { plant: 'Rose', days: 63, kind: 'treated', note: 'Picked off and binned the spotted leaves.', issue: 'Black spot' },
  { plant: 'Tomatoes', days: 63, kind: 'harvested', note: 'First ripe trusses.', photos: 4 },
  { plant: 'Runner beans', days: 60, kind: 'harvested', note: 'Picking every other day.', photos: 1 },
  { plant: 'Leeks', days: 55, kind: 'watered' },
  { plant: 'Tomatoes', days: 51, kind: 'watered', note: 'Watering every morning now, not when they look dry.', issue: 'Blossom end rot' },
  { plant: 'Dahlia', days: 50, kind: 'fed', product: 'Tomorite' },
  { plant: 'Runner beans', days: 45, kind: 'watered' },
  { plant: 'Hydrangea', days: 42, kind: 'checked' },
  { plant: 'Hosta', days: 38, kind: 'treated', product: 'Wool pellets', issue: 'Slug damage on leaves' },
  { plant: 'Sweet peas', days: 35, kind: 'other', note: 'Pulled up and composted. Saved seed from the best.' },
  { plant: 'Rose', days: 33, kind: 'checked', issue: 'Black spot' },
  { plant: 'Tomatoes', days: 30, kind: 'harvested', note: 'A full bowl. The new fruit is clean.' },
  { plant: 'Fuchsia', days: 28, kind: 'other', note: 'Basket taken down and composted.' },
  { plant: 'Apple tree', days: 25, kind: 'pruned', note: 'Cut the split branch back to a clean collar.', issue: 'Branch split in the wind' },
  { plant: 'Raspberries', days: 22, kind: 'harvested', note: 'Autumn crop going strong.', photos: 2 },
  { plant: 'Courgette', days: 19, kind: 'pruned', note: 'Took off the worst leaves.', issue: 'Powdery mildew' },
  { plant: 'Peony', days: 18, kind: 'pruned', note: 'Cut the foliage down to the ground.' },
  { plant: 'Basil', days: 15, kind: 'observation', note: 'Gone black after the cold night. Not coming back.', photos: 1 },
  { plant: 'Dahlia', days: 14, kind: 'observation', note: 'Still flowering. Earwigs in a few blooms.', photos: 3 },
  { plant: 'Box hedge', days: 11, kind: 'treated', product: 'XenTari', issue: 'Box tree caterpillar' },
  { plant: 'Hosta', days: 9, kind: 'checked', note: 'Still getting through the pellets.', issue: 'Slug damage on leaves' },
  { plant: 'Apple tree', days: 6, kind: 'harvested', note: 'First russets. Leaving the rest another week.', photos: 2 },
  { plant: 'Clematis', days: 3, kind: 'checked' }
];

// Light, ground, leaves and flowers for the drawn sample photos
const SCENES = [
  ['#dfe8da', '#4a6b52', '#2f4a38', '#c99aab'],
  ['#e5ebe1', '#5d6b62', '#4a6b52', '#ecead2'],
  ['#f2e2e7', '#4a6b52', '#263d2e', '#a8566f'],
  ['#ecead2', '#655812', '#4a6b52', '#8d4660'],
  ['#dde5ec', '#44524a', '#2f4a38', '#b8a9d4']
];

/**
 * The same numbers on every load, so the sample always looks the same.
 * @param {number} seed
 */
function random(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A soft picture of leaves and flowers, put through the same processing as
 * a photo she picks.
 * @param {number} seed
 * @param {string} occurredOn
 */
async function samplePhoto(seed, occurredOn) {
  const width = 1200;
  const height = 900;
  const next = random(seed);
  const [light, ground, leaf, flower] = SCENES[seed % SCENES.length];
  const canvas = new OffscreenCanvas(width, height);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, light);
  background.addColorStop(1, ground);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  /**
   * @param {string} colour
   * @param {number} count
   * @param {number} size
   * @param {number} roundness 1 for circles
   */
  const scatter = (colour, count, size, roundness) => {
    context.fillStyle = colour;
    for (let i = 0; i < count; i++) {
      context.globalAlpha = 0.5 + next() * 0.5;
      const length = size * (0.5 + next());
      context.beginPath();
      context.ellipse(next() * width, height * (0.25 + next() * 0.75), length, length * roundness, next() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
  };
  scatter(leaf, 70, 70, 0.3);
  scatter(flower, 14, 22, 1);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  const lastModified = new Date(`${occurredOn}T10:00:00`).getTime();
  return processPhoto(new File([blob], `sample-${seed}.jpg`, { type: 'image/jpeg', lastModified }));
}

/** @param {number} days */
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
}

/** @returns {Promise<string>} the new garden's id */
export async function loadSampleGarden() {
  const gardenId = await createGarden(GARDEN);

  const plantIds = new Map();
  for (const { planted, ...plant } of PLANTS) {
    plantIds.set(plant.commonName, await createPlant(gardenId, { ...plant, plantedOn: planted && daysAgo(planted) }));
  }

  const issueIds = new Map();
  for (const { plant, firstSeen, status, ...issue } of ISSUES) {
    issueIds.set(issue.title, await createIssue(plantIds.get(plant), { ...issue, firstSeenOn: daysAgo(firstSeen) }));
  }

  // Photos need a canvas, which the tests running in Node do not have
  const canDraw = typeof OffscreenCanvas !== 'undefined';
  let drawn = 0;
  for (const { plant, days, issue, photos: count = 0, ...entry } of ENTRIES) {
    const occurredOn = daysAgo(days);
    const photos = [];
    if (canDraw) for (let i = 0; i < count; i++) photos.push(await samplePhoto(++drawn, occurredOn));
    await createEntry(plantIds.get(plant), { ...entry, occurredOn, issueId: issue && issueIds.get(issue), photos });
  }

  // Last, because each status change is noted in the timeline today
  for (const { title, status } of ISSUES) {
    if (status !== 'open') await setIssueStatus(issueIds.get(title), /** @type {'watching' | 'resolved'} */ (status));
  }

  return gardenId;
}
