import { db, current, isCurrent } from './schema.js';
import { write } from './write.js';
import { clean } from './fields.js';

/**
 * Read and write functions for a table of records that belong to a garden
 * and need nothing beyond the basics. Used by the tables that have no
 * screens yet: areas, tasks and visits.
 * @param {string} table
 * @param {Record<string, import('./fields.js').Rule>} rules
 */
export function gardenRecords(table, rules) {
  return {
    /** @param {string} gardenId */
    list: (gardenId) => db.table(table).where('gardenId').equals(gardenId).filter(isCurrent).toArray(),

    /** @param {string} id */
    get: async (id) => current(await db.table(table).get(id)),

    /**
     * @param {string} gardenId
     * @param {Record<string, any>} input
     * @returns {Promise<string>} the new record's id
     */
    create: (gardenId, input) =>
      write(`create ${table}`, ['gardens', table], async (w) => {
        const fields = clean(input, rules);
        await w.get('gardens', gardenId);
        return (await w.create(table, { gardenId, ...fields })).id;
      }),

    /**
     * @param {string} id
     * @param {Record<string, any>} input
     */
    update: async (id, input) => {
      await write(`update ${table}`, [table], (w) => w.update(table, id, clean(input, rules, { partial: true })));
    },

    /**
     * @param {string} id
     * @returns {Promise<string>} the deletedAt to pass to restore
     */
    remove: (id) =>
      write(`delete ${table}`, [table], async (w) => {
        await w.remove(table, id);
        return w.at;
      }),

    /**
     * @param {string} id
     * @param {string} deletedAt
     */
    restore: (id, deletedAt) => write(`restore ${table}`, [table], (w) => w.restoreWhere(table, 'id', id, deletedAt))
  };
}
