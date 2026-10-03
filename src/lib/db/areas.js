import { gardenRecords } from './records.js';
import { longText, number, oneOf, required, shortText } from './fields.js';
import { SUN } from '../constants.js';

export const {
  list: listAreas,
  get: getArea,
  create: createArea,
  update: updateArea,
  remove: deleteArea,
  restore: restoreArea
} = gardenRecords('areas', {
  name: required(shortText),
  sun: oneOf(SUN, null),
  notes: longText,
  x: number(),
  y: number()
});
